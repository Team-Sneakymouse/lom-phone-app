package com.lomphone.expansion

import com.lomphone.FakeApi
import com.lomphone.service.Bridge
import java.lang.reflect.Proxy
import java.util.UUID
import org.bukkit.OfflinePlayer
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class StepsExpansionTest {
    @Test
    fun papiExpansionIsCacheOnlyAndUnknownUntilFetchApplies() {
        val api = FakeApi()
        val main = ArrayList<Runnable>()
        val id = UUID.randomUUID()
        val bridge = Bridge(api, { main.add(it) }, { 1000 }, "codes", "steps", 300000, 30000, 90000, 2)
        val player =
            Proxy.newProxyInstance(
                javaClass.classLoader,
                arrayOf(OfflinePlayer::class.java),
            ) { _, method, _ ->
                if (method.name == "getUniqueId") id else null
            } as OfflinePlayer
        val expansion = StepsExpansion(bridge, "test")
        assertEquals("lomphone", expansion.identifier)
        assertTrue(expansion.persist())
        assertEquals("unknown", expansion.onRequest(player, "steps"))
        assertEquals(0, api.reads)
        assertNull(expansion.onRequest(player, "other"))
        assertEquals("unknown", expansion.onRequest(null, "steps"))
        bridge.refresh(id)
        api.read.complete(listOf("""{"minecraft_uuid":"$id","total_steps":5}"""))
        main.forEach(Runnable::run)
        assertEquals("5", expansion.onRequest(player, "steps"))
        assertEquals(1, api.reads)
    }
}
