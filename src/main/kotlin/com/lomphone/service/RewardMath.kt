package com.lomphone.service

/** Configured step→mail tier from bridge config. */
data class RewardTier(
    val every: Long,
    val key: String,
    val note: String,
    val command: String,
)

/** One unpaid crossing that should become mail. */
data class DueReward(
    val rewardKey: String,
    val thresholdSteps: Long,
    val tier: RewardTier,
)

object RewardMath {
    /**
     * For each tier, crossings `1..floor(total/every)` that are not already in [existingKeys]
     * become due. Caps how many are returned so one tick cannot flood mail.
     */
    fun dueRewards(
        totalSteps: Long,
        existingKeys: Set<String>,
        tiers: List<RewardTier>,
        maxDue: Int = 20,
    ): List<DueReward> {
        if (totalSteps <= 0 || maxDue <= 0) return emptyList()
        val out = ArrayList<DueReward>(maxDue)
        for (tier in tiers) {
            if (tier.every <= 0 || tier.key.isBlank()) continue
            val crossings = totalSteps / tier.every
            var i = 1L
            while (i <= crossings) {
                val rewardKey = "${tier.key}:$i"
                if (rewardKey !in existingKeys) {
                    out.add(DueReward(rewardKey, i * tier.every, tier))
                    if (out.size >= maxDue) return out
                }
                i++
            }
        }
        return out
    }

    fun mailSourceKey(minecraftUuid: String, rewardKey: String): String =
        "lomphone:$minecraftUuid:$rewardKey"
}
