package com.lomphone.service

import com.danidipp.sneakypocketbase.PocketbaseApi
import com.danidipp.sneakypocketbase.PocketbaseLifecycleSnapshot
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.Instant
import java.util.UUID
import java.util.function.LongSupplier
import java.util.logging.Logger

/**
 * Reads accepted step totals, mails unpaid reward crossings via lom2_mail, writes ledger rows,
 * advances paid_steps, and GCs old ledger entries.
 */
class RewardPayout(
    private val api: PocketbaseApi,
    private val clock: LongSupplier,
    private val log: Logger,
    private val stepsCollection: String,
    private val ledgerCollection: String,
    private val mailCollection: String,
    private val mailSenderName: String,
    private val tiers: List<RewardTier>,
    private val ledgerRetentionMs: Long,
    private val maxDuePerPlayer: Int,
) {
    @Volatile private var enabled = true
    @Volatile private var running = false

    fun stop() {
        enabled = false
    }

    /** Fire-and-forget payout pass (call from async or timer). */
    fun runPass(playerIds: Collection<UUID>) {
        if (!enabled || tiers.isEmpty() || playerIds.isEmpty()) return
        if (api.lifecycleSnapshot.apiState != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE) return
        if (running) return
        running = true
        try {
            for (id in playerIds) {
                if (!enabled) break
                try {
                    processPlayer(id)
                } catch (ex: Exception) {
                    log.warning("Reward payout failed for $id: ${ex.message}")
                }
            }
            if (enabled) gcLedger()
        } finally {
            running = false
        }
    }

    private fun processPlayer(player: UUID) {
        val uuid = player.toString()
        val stepRecords =
            api.getFullList(stepsCollection, 2, "", "minecraft_uuid='$uuid'").join()
        if (stepRecords.size != 1) return
        val step = JsonParser.parseString(stepRecords.first()).asJsonObject
        val total = step.get("total_steps")?.asLong ?: return
        val paid = step.get("paid_steps")?.asLong ?: 0L
        val stepId = step.get("id").asString

        val ledgerRecords =
            api.getFullList(
                    ledgerCollection,
                    200,
                    "",
                    "minecraft_uuid='$uuid'",
                )
                .join()
        val existing =
            ledgerRecords
                .mapNotNull {
                    JsonParser.parseString(it).asJsonObject.get("reward_key")?.asString
                }
                .toHashSet()

        val due = RewardMath.dueRewards(total, existing, tiers, maxDuePerPlayer)
        if (due.isEmpty()) {
            if (paid < total) {
                patchPaid(stepId, total)
            }
            return
        }

        val now = Instant.ofEpochMilli(clock.asLong).toString()
        var mailed = 0
        for (reward in due) {
            val sourceKey = RewardMath.mailSourceKey(uuid, reward.rewardKey)
            val mailBody =
                mailJson(
                    recipientUuid = uuid,
                    note = reward.tier.note,
                    command = reward.tier.command,
                    sourceKey = sourceKey,
                )
            try {
                api.create(mailCollection, mailBody).join()
            } catch (ex: Exception) {
                // Unique source_key → already mailed; continue to ensure ledger exists.
                log.fine("Mail create for $sourceKey: ${ex.message}")
            }

            val ledgerBody =
                JsonObject()
                    .apply {
                        addProperty("minecraft_uuid", uuid)
                        addProperty("reward_key", reward.rewardKey)
                        addProperty("threshold_steps", reward.thresholdSteps)
                        addProperty("mail_source_key", sourceKey)
                        addProperty("mailed_at", now)
                    }
                    .toString()
            try {
                api.create(ledgerCollection, ledgerBody).join()
                mailed++
            } catch (ex: Exception) {
                log.fine("Ledger create for ${reward.rewardKey}: ${ex.message}")
            }
        }

        // Advance cursor to total after attempting dues (ledger+source_key are idempotent).
        patchPaid(stepId, total)
        if (mailed > 0) {
            log.info("Queued $mailed step reward mail(s) for $uuid (total=$total)")
        }
    }

    private fun patchPaid(stepId: String, paidSteps: Long) {
        val body = JsonObject().apply { addProperty("paid_steps", paidSteps) }.toString()
        api.update(stepsCollection, stepId, body).join()
    }

    private fun gcLedger() {
        if (ledgerRetentionMs <= 0) return
        val cutoff = Instant.ofEpochMilli(clock.asLong - ledgerRetentionMs).toString()
        try {
            val old =
                api.getFullList(
                        ledgerCollection,
                        100,
                        "",
                        "mailed_at<'$cutoff'",
                    )
                    .join()
            for (raw in old) {
                val id = JsonParser.parseString(raw).asJsonObject.get("id")?.asString ?: continue
                try {
                    api.delete(ledgerCollection, id).join()
                } catch (_: Exception) {
                    // best-effort
                }
            }
        } catch (ex: Exception) {
            log.fine("Ledger GC skipped: ${ex.message}")
        }
    }

    private fun mailJson(
        recipientUuid: String,
        note: String,
        command: String,
        sourceKey: String,
    ): String {
        val rewards = JsonArray()
        rewards.add(
            JsonObject().apply {
                addProperty("type", "command")
                addProperty("command", command)
            },
        )
        return JsonObject()
            .apply {
                addProperty("sender_uuid", "")
                addProperty("sender_name", mailSenderName)
                addProperty("recipient_uuid", recipientUuid)
                addProperty("recipient_name", "")
                addProperty("available", true)
                addProperty("note", note)
                add("rewards", rewards)
                addProperty("source_key", sourceKey)
            }
            .toString()
    }
}
