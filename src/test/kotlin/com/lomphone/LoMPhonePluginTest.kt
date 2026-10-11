package com.lomphone

import com.danidipp.sneakypocketbase.PocketbaseApi
import com.danidipp.sneakypocketbase.PocketbaseProvider
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockbukkit.mockbukkit.MockBukkit

class LoMPhonePluginTest {
    @BeforeEach
    fun setUp() {
        MockBukkit.mock()
        installApi(FakeApi())
    }

    @AfterEach
    fun tearDown() {
        clearApi()
        MockBukkit.unmock()
    }

    @Test
    fun loadsAndEnablesWithoutError() {
        val plugin = MockBukkit.load(LoMPhonePlugin::class.java)
        assertNotNull(plugin)
        assertTrue(plugin.isEnabled)
    }

    private fun installApi(api: PocketbaseApi) {
        val install =
            PocketbaseProvider::class.java.getDeclaredMethod("install", PocketbaseApi::class.java)
        install.isAccessible = true
        install.invoke(null, api)
    }

    private fun clearApi() {
        val clear = PocketbaseProvider::class.java.getDeclaredMethod("clear")
        clear.isAccessible = true
        clear.invoke(null)
    }
}
