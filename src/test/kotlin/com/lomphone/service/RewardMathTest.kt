package com.lomphone.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RewardMathTest {
    private val tiers =
        listOf(
            RewardTier(1000, "walk_1k", "note", "cmd {player}"),
            RewardTier(5000, "walk_5k", "note5", "cmd5 {player}"),
        )

    @Test
    fun noStepsMeansNothingDue() {
        assertTrue(RewardMath.dueRewards(0, emptySet(), tiers).isEmpty())
    }

    @Test
    fun firstThousandCrossing() {
        val due = RewardMath.dueRewards(1000, emptySet(), tiers)
        assertEquals(listOf("walk_1k:1"), due.map { it.rewardKey })
        assertEquals(1000L, due.single().thresholdSteps)
    }

    @Test
    fun fiveThousandYieldsBothTiers() {
        val due = RewardMath.dueRewards(5000, emptySet(), tiers)
        val keys = due.map { it.rewardKey }.toSet()
        assertTrue("walk_1k:1" in keys)
        assertTrue("walk_1k:5" in keys)
        assertTrue("walk_5k:1" in keys)
    }

    @Test
    fun existingLedgerKeysAreSkipped() {
        val due =
            RewardMath.dueRewards(
                3000,
                setOf("walk_1k:1", "walk_1k:2"),
                tiers,
            )
        assertEquals(listOf("walk_1k:3"), due.map { it.rewardKey })
    }

    @Test
    fun maxDueCapsFlood() {
        val due = RewardMath.dueRewards(50_000, emptySet(), tiers, maxDue = 3)
        assertEquals(3, due.size)
    }

    @Test
    fun mailSourceKeyIsStable() {
        assertEquals(
            "lomphone:98ec946a-6fbf-45a5-8408-d6f8a0804f97:walk_1k:1",
            RewardMath.mailSourceKey("98ec946a-6fbf-45a5-8408-d6f8a0804f97", "walk_1k:1"),
        )
    }
}
