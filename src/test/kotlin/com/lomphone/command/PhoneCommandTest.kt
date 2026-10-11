package com.lomphone.command

import com.lomphone.FakeApi
import com.lomphone.service.Bridge
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PhoneCommandTest {
    @Test
    fun logoutInvalidatesConfirmation() {
        val api = FakeApi()
        val bridge = Bridge(api, Runnable::run, { 1000 }, "codes", "steps", 300000, 30000, 90000, 2)
        val command = PhoneCommand(bridge)
        val player = UUID.randomUUID()
        val replies = ArrayList<PhoneCommand.Reply>()
        command.execute(player, true, arrayOf("link"), replies::add, 1000)
        val nonce = replies.first().clickCommand!!.removePrefix("/lomphone confirm ")
        command.forget(player)
        command.execute(player, true, arrayOf("confirm", nonce), replies::add, 1001)
        assertEquals(0, api.writes)
    }

    @Test
    fun consoleAndPermissionDeniedCannotEvenGetWarning() {
        val api = FakeApi()
        val bridge = Bridge(api, Runnable::run, { 1000 }, "codes", "steps", 300000, 30000, 90000, 2)
        val command = PhoneCommand(bridge)
        val replies = ArrayList<PhoneCommand.Reply>()
        command.execute(null, true, arrayOf("link"), replies::add, 1000)
        command.execute(UUID.randomUUID(), false, arrayOf("link"), replies::add, 1000)
        assertEquals(2, replies.size)
        assertTrue(replies.all { it.clickCommand == null })
        assertEquals(0, api.writes)
    }

    @Test
    fun linkWarnsPrivatelyAndClickAloneCanPersist() {
        val api = FakeApi()
        val main = ArrayList<Runnable>()
        val bridge = Bridge(api, { main.add(it) }, { 1000 }, "codes", "steps", 300000, 30000, 90000, 2)
        val command = PhoneCommand(bridge)
        val player = UUID.randomUUID()
        val replies = ArrayList<PhoneCommand.Reply>()
        command.execute(player, true, arrayOf("confirm", "invented"), replies::add, 1000)
        assertEquals(0, api.writes)
        replies.clear()
        command.execute(player, true, arrayOf("link"), replies::add, 1000)
        assertEquals(0, api.writes)
        assertEquals(1, replies.size)
        assertTrue(replies.first().text.contains("secret"))
        val click = replies.first().clickCommand!!
        assertTrue(click.startsWith("/lomphone confirm "))
        val nonce = click.removePrefix("/lomphone confirm ")
        command.execute(player, true, arrayOf("confirm", nonce), replies::add, 1001)
        assertEquals(1, api.writes)
        command.execute(player, true, arrayOf("confirm", nonce), replies::add, 1002)
        assertEquals(1, api.writes)
        api.write.complete("{}")
        main.forEach(Runnable::run)
        val codeReply = replies.first { it.text.startsWith("Private linking code:") }
        assertTrue(codeReply.offerClearChat)
        assertTrue(replies.none { it !== codeReply && it.offerClearChat })
    }
}
