package com.lomphone.service

import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class LinkFlowTest {
    @Test
    fun expiredOrReplacedWarningCannotConfirm() {
        val flow = LinkFlow()
        val id = UUID.randomUUID()
        val old = flow.warn(id, 0)
        val current = flow.warn(id, 1)
        assertNull(flow.confirm(id, old, 2))
        assertNull(flow.confirm(id, current, 60_001))
    }

    @Test
    fun warningDoesNotCreateCodeAndConfirmationWithoutWarningIsRejected() {
        val flow = LinkFlow()
        val player = UUID.randomUUID()
        assertNull(flow.confirm(player, "anything", 0))
        val nonce = flow.warn(player, 0)
        assertNotNull(nonce)
        assertNull(flow.confirm(UUID.randomUUID(), nonce, 1))
        assertEquals(player, flow.confirm(player, nonce, 1))
        assertNull(flow.confirm(player, nonce, 2))
    }
}
