package com.lomphone.service

import com.google.gson.JsonParser
import com.lomphone.FakeApi
import com.lomphone.util.Crockford
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.HexFormat
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class BridgeTest {
    private val api = FakeApi()
    private val main = ArrayList<Runnable>()
    private var now = 1_000L
    private val player = UUID.randomUUID()
    private val bridge =
        Bridge(
            api,
            { main.add(it) },
            { now },
            "phone_link_codes",
            "phone_player_steps",
            300_000,
            30_000,
            90_000,
            2,
        )

    private fun drain() {
        val jobs = main.toList()
        main.clear()
        jobs.forEach(Runnable::run)
    }

    private fun digest(code: String): String =
        HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(code.toByteArray(StandardCharsets.UTF_8)),
        )

    @Test
    fun unsafeCollectionNamesAndInvalidBoundsAreRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            Bridge(api, { main.add(it) }, { now }, "codes/secret", "steps", 300000, 30000, 90000, 2)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Bridge(api, { main.add(it) }, { now }, "codes", "steps", 0, 30000, 90000, 2)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Bridge(api, { main.add(it) }, { now }, "codes", "steps", 300000, 0, 90000, 2)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Bridge(api, { main.add(it) }, { now }, "codes", "steps", 300000, 30000, 1000, 2)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Bridge(api, { main.add(it) }, { now }, "codes", "steps", 300000, 30000, 90000, 0)
        }
    }

    @Test
    fun readinessLostBeforeWriteApplyDoesNotRevealCode() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.complete("{}")
        api.available = false
        drain()
        assertTrue(messages.isEmpty())
    }

    @Test
    fun codeAlreadyExpiredAtApplyTimeIsNotRevealed() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.complete("{}")
        now += 300_000
        drain()
        assertFalse(messages.any { it.startsWith("Private linking code:") })
    }

    @Test
    fun synchronousReadFailureDoesNotLeakOrExhaustSlots() {
        api.throwRead = true
        assertDoesNotThrow { bridge.refresh(player) }
        api.throwRead = false
        now += 30_000
        bridge.refresh(player)
        api.read.complete(emptyList())
        drain()
        bridge.refresh(UUID.randomUUID())
        assertEquals(2, api.reads)
    }

    @Test
    fun synchronousFailureIsSanitizedAndReleasesWriteSlot() {
        api.throwWrite = true
        val messages = ArrayList<String>()
        assertDoesNotThrow { bridge.issue(player, messages::add) }
        assertEquals(listOf("Linking unavailable. Please try again later."), messages)
        api.throwWrite = false
        bridge.issue(player, messages::add)
        assertEquals(1, api.writes)
    }

    @Test
    fun writesAreGloballyBoundedEvenAcrossPlayers() {
        bridge.issue(player) {}
        bridge.issue(UUID.randomUUID()) {}
        bridge.issue(UUID.randomUUID()) {}
        assertEquals(2, api.writes)
    }

    @Test
    fun logoutAndRejoinCannotApplyPreviousSessionRead() {
        bridge.refresh(player)
        val old = api.read
        bridge.forget(player)
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":8}"""))
        drain()
        old.complete(listOf("""{"minecraft_uuid":"$player","total_steps":1}"""))
        drain()
        assertEquals("8", bridge.placeholder(player))
    }

    @Test
    fun stoppedOrOfflineServiceNeverFetchesOrAppliesSteps() {
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":3}"""))
        bridge.stop()
        drain()
        bridge.refresh(UUID.randomUUID())
        assertEquals("unknown", bridge.placeholder(player))
        assertEquals(1, api.reads)
    }

    @Test
    fun refreshIsRateLimitedButGenerationRecoveryBypassesDelay() {
        bridge.refresh(player)
        api.read.complete(emptyList())
        drain()
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        assertEquals(1, api.reads)
        now += 30_000
        bridge.refresh(player)
        assertEquals(2, api.reads)
        api.generation++
        bridge.refresh(player)
        assertEquals(3, api.reads)
    }

    @Test
    fun readConcurrencyIsBoundedAndSamePlayerDoesNotOverlap() {
        bridge.refresh(player)
        bridge.refresh(player)
        bridge.refresh(UUID.randomUUID())
        bridge.refresh(UUID.randomUUID())
        assertEquals(2, api.reads)
    }

    @Test
    fun oldReadCompletingAfterNewGenerationDoesNotOverwriteRecovery() {
        bridge.refresh(player)
        val old = api.read
        api.generation++
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":9}"""))
        drain()
        old.complete(listOf("""{"minecraft_uuid":"$player","total_steps":2}"""))
        drain()
        assertEquals("9", bridge.placeholder(player))
    }

    @Test
    fun offlineAndGenerationChangesInvalidateCacheBeforeRecovery() {
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":3}"""))
        drain()
        api.available = false
        assertEquals("unknown", bridge.placeholder(player))
        api.generation++
        api.available = true
        assertEquals("unknown", bridge.placeholder(player))
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":4}"""))
        drain()
        assertEquals("4", bridge.placeholder(player))
    }

    @Test
    fun staleTotalsBecomeUnknownWithoutBlocking() {
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":3}"""))
        drain()
        assertEquals("3", bridge.placeholder(player))
        now += 90_000
        assertEquals("unknown", bridge.placeholder(player))
    }

    @Test
    fun uuidMustMatchAndExplicitZeroIsNotUnknown() {
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"${UUID.randomUUID()}","total_steps":0}"""))
        drain()
        assertEquals("unknown", bridge.placeholder(player))
        now += 30_000
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":0}"""))
        drain()
        assertEquals("0", bridge.placeholder(player))
    }

    @Test
    fun malformedNegativeFractionalAndDuplicateStepsAreUnknown() {
        val invalid =
            arrayOf(
                "not json",
                "{}",
                """{"total_steps":-1}""",
                """{"total_steps":1.5}""",
                """{"total_steps":"2"}""",
                """{"total_steps":true}""",
                """{"total_steps":9007199254740992}""",
            )
        for (record in invalid) {
            now += 30_000
            api.read = java.util.concurrent.CompletableFuture()
            bridge.refresh(player)
            val json =
                if (record.startsWith("{")) {
                    record.replace("{", """{"minecraft_uuid":"$player",""")
                } else {
                    record
                }
            api.read.complete(listOf(json))
            assertDoesNotThrow { drain() }
            assertEquals("unknown", bridge.placeholder(player))
        }
        now += 30_000
        api.read = java.util.concurrent.CompletableFuture()
        bridge.refresh(player)
        api.read.complete(listOf("""{"total_steps":1}""", """{"total_steps":2}"""))
        drain()
        assertEquals("unknown", bridge.placeholder(player))
    }

    @Test
    fun stepsAreFetchedByUuidAndPlaceholdersNeverWaitForNetwork() {
        bridge.refresh(player)
        assertEquals(1, api.reads)
        assertEquals("minecraft_uuid = '$player'", api.filter)
        assertEquals("unknown", bridge.placeholder(player))
        api.read.complete(listOf("""{"minecraft_uuid":"$player","total_steps":42}"""))
        assertEquals("unknown", bridge.placeholder(player))
        drain()
        assertEquals("42", bridge.placeholder(player))
    }

    @Test
    fun leavingPlayerCannotReceiveQueuedCode() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.complete("{}")
        bridge.forget(player)
        drain()
        assertTrue(messages.isEmpty())
    }

    @Test
    fun unavailableApiRejectsCodeWithoutNetworkOrSecret() {
        api.available = false
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        assertEquals(0, api.writes)
        assertEquals(listOf("Linking unavailable. Please try again later."), messages)
    }

    @Test
    fun stoppedBridgeDropsQueuedWriteAndRejectsNewWork() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.complete("{}")
        bridge.stop()
        drain()
        bridge.issue(UUID.randomUUID(), messages::add)
        assertTrue(messages.isEmpty())
        assertEquals(1, api.writes)
    }

    @Test
    fun oldGenerationWriteCannotRevealCodeAfterScheduledCompletion() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.complete("{}")
        api.generation++
        drain()
        assertTrue(messages.isEmpty())
    }

    @Test
    fun repeatedConfirmationWhileWriteInFlightDoesNotCreateAnotherCode() {
        bridge.issue(player) {}
        bridge.issue(player) {}
        assertEquals(1, api.writes)
    }

    @Test
    fun failedWritesNeverRevealCodeOrRetry() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        api.write.completeExceptionally(RuntimeException("secret backend response"))
        drain()
        assertEquals(listOf("Linking unavailable. Please try again later."), messages)
        assertEquals(1, api.writes)
    }

    @Test
    fun codeOnlyDisplayedAfterPersistenceAndOnlyDigestStored() {
        val messages = ArrayList<String>()
        bridge.issue(player, messages::add)
        assertEquals(1, api.writes)
        assertTrue(messages.isEmpty())
        val record = JsonParser.parseString(api.json).asJsonObject
        assertEquals(player.toString(), record.get("minecraft_uuid").asString)
        assertTrue(record.get("code_digest").asString.matches(Regex("[a-f0-9]{64}")))
        api.write.complete("{}")
        assertTrue(messages.isEmpty())
        drain()
        assertEquals(1, messages.size)
        assertTrue(messages.first().startsWith("Private linking code: "))
        val code = messages.first().removePrefix("Private linking code: ")
        assertTrue(Crockford.isLinkCode(code))
        assertFalse(api.json!!.contains(code))
        assertEquals(digest(code), record.get("code_digest").asString)
        assertEquals(
            300_000,
            Duration.between(
                    Instant.parse(record.get("created_at").asString),
                    Instant.parse(record.get("expires_at").asString),
                )
                .toMillis(),
        )
    }
}
