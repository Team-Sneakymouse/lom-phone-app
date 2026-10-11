package com.lomphone.service

import com.danidipp.sneakypocketbase.PocketbaseApi
import com.danidipp.sneakypocketbase.PocketbaseLifecycleSnapshot
import com.google.gson.JsonParser
import com.lomphone.util.Crockford
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.HexFormat
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.function.Consumer
import java.util.function.LongSupplier

/** Main-thread service; executor must enqueue on the Paper main thread. */
class Bridge(
    private val api: PocketbaseApi,
    private val main: Consumer<Runnable>,
    private val clock: LongSupplier,
    private val links: String,
    private val steps: String,
    private val codeTtl: Long,
    private val refresh: Long,
    private val stale: Long,
    private val maxRequests: Int,
) {
    private data class Attempt(val at: Long, val generation: Long)

    private data class ReadJob(val generation: Long, val identity: Any = Any())

    private data class Total(val value: String, val fetchedAt: Long, val generation: Long)

    @Volatile private var enabled = true
    private val attempts = HashMap<UUID, Attempt>()
    private val reading = HashMap<UUID, ReadJob>()
    private var activeReads = 0
    private val cache = ConcurrentHashMap<UUID, Total>()
    private val deliveries = HashMap<UUID, Any>()
    private val writing = HashSet<UUID>()
    private val random = SecureRandom()

    init {
        require(
            links.matches(COLLECTION_NAME) &&
                steps.matches(COLLECTION_NAME) &&
                codeTtl in 30_000..900_000 &&
                refresh in 5_000..300_000 &&
                stale in refresh..900_000 &&
                maxRequests in 1..64,
        ) { "Invalid bridge configuration" }
    }

    fun issue(player: UUID, result: Consumer<String>) {
        if (!enabled) return
        if (api.lifecycleSnapshot.apiState != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE) {
            result.accept(UNAVAILABLE)
            return
        }
        if (writing.size >= maxRequests || !writing.add(player)) {
            result.accept(UNAVAILABLE)
            return
        }
        val delivery = Any()
        deliveries[player] = delivery
        val generation = api.lifecycleSnapshot.generation
        val expires = clock.asLong + codeTtl
        val code = Crockford.encodeRandom(random)
        val digest =
            HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(code.toByteArray(StandardCharsets.UTF_8)),
            )
        val record =
            """{"minecraft_uuid":"$player","code_digest":"$digest","created_at":"${Instant.ofEpochMilli(clock.asLong)}","expires_at":"${Instant.ofEpochMilli(expires)}"}"""
        try {
            api.create(links, record).whenComplete { _, failure ->
                main.accept(
                    Runnable {
                        writing.remove(player)
                        if (!deliveries.remove(player, delivery)) return@Runnable
                        if (!enabled ||
                            api.lifecycleSnapshot.apiState !=
                                PocketbaseLifecycleSnapshot.ApiState.AVAILABLE ||
                            api.lifecycleSnapshot.generation != generation
                        ) {
                            return@Runnable
                        }
                        result.accept(
                            if (failure == null && clock.asLong < expires) {
                                "Private linking code: $code"
                            } else {
                                UNAVAILABLE
                            },
                        )
                    },
                )
            }
        } catch (_: RuntimeException) {
            writing.remove(player)
            deliveries.remove(player)
            result.accept(UNAVAILABLE)
        }
    }

    fun refresh(player: UUID) {
        if (!enabled ||
            api.lifecycleSnapshot.apiState != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
        ) {
            return
        }
        val started = clock.asLong
        val generation = api.lifecycleSnapshot.generation
        if (activeReads >= maxRequests ||
            reading[player]?.generation == generation
        ) {
            return
        }
        val last = attempts[player]
        if (last != null && last.generation == generation && started - last.at < refresh) return
        attempts[player] = Attempt(started, generation)
        val job = ReadJob(generation)
        reading[player] = job
        activeReads++
        try {
            api.getFullList(steps, 2, "", "minecraft_uuid = '$player'")
                .whenComplete { records, failure ->
                    main.accept(
                        Runnable {
                            activeReads--
                            if (!reading.remove(player, job)) return@Runnable
                            if (!enabled ||
                                api.lifecycleSnapshot.apiState !=
                                    PocketbaseLifecycleSnapshot.ApiState.AVAILABLE ||
                                api.lifecycleSnapshot.generation != generation
                            ) {
                                return@Runnable
                            }
                            val value = if (failure == null) parseSteps(player, records) else null
                            if (value == null) cache.remove(player)
                            else cache[player] = Total(value, started, generation)
                        },
                    )
                }
        } catch (_: RuntimeException) {
            activeReads--
            reading.remove(player)
            cache.remove(player)
        }
    }

    fun placeholder(player: UUID): String {
        val snapshot = api.lifecycleSnapshot
        val total = cache[player]
        return if (!enabled ||
            snapshot.apiState != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE ||
            total == null ||
            total.generation != snapshot.generation ||
            clock.asLong - total.fetchedAt >= stale
        ) {
            "unknown"
        } else {
            total.value
        }
    }

    fun forget(player: UUID) {
        deliveries.remove(player)
        reading.remove(player)
        attempts.remove(player)
        cache.remove(player)
    }

    fun stop() {
        enabled = false
    }

    companion object {
        private val COLLECTION_NAME = Regex("[a-zA-Z][a-zA-Z0-9_]{0,63}")
        private const val UNAVAILABLE = "Linking unavailable. Please try again later."
        private const val MAX_SAFE = 9_007_199_254_740_991L

        private fun parseSteps(player: UUID, records: List<String>?): String? {
            if (records == null || records.size != 1) return null
            return try {
                val record = JsonParser.parseString(records.first()).asJsonObject
                if (player.toString() != record.get("minecraft_uuid").asString) return null
                val value = record.get("total_steps")
                if (value == null || !value.isJsonPrimitive || !value.asJsonPrimitive.isNumber) {
                    return null
                }
                val total = value.asBigDecimal.longValueExact()
                if (total in 0..MAX_SAFE) total.toString() else null
            } catch (_: RuntimeException) {
                null
            }
        }
    }
}
