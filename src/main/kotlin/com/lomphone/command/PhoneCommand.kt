package com.lomphone.command

import com.lomphone.service.Bridge
import com.lomphone.service.LinkFlow
import java.util.UUID
import java.util.function.Consumer

/** Private response routing; the adapter must send every reply only to the sender. */
class PhoneCommand(private val bridge: Bridge) {
    data class Reply(
        val text: String,
        val clickCommand: String? = null,
        /** When true, the adapter should offer a clickable clear-chat control. */
        val offerClearChat: Boolean = false,
    )

    private val confirmations = LinkFlow()

    fun execute(
        player: UUID?,
        allowed: Boolean,
        args: Array<out String>,
        send: Consumer<Reply>,
        now: Long,
    ) {
        if (player == null) {
            send.accept(Reply("Only players can use this command."))
            return
        }
        if (!allowed) {
            send.accept(Reply("You do not have permission to link a phone."))
            return
        }
        when {
            args.size == 1 && args[0].equals("link", ignoreCase = true) -> {
                val nonce = confirmations.warn(player, now)
                send.accept(
                    Reply(
                        "Keep your linking code secret. Never share it in chat or screenshots. Click to" +
                            " create a private code (short-lived).",
                        clickCommand = "/lomphone confirm $nonce",
                    ),
                )
            }
            args.size == 2 && args[0].equals("confirm", ignoreCase = true) -> {
                if (confirmations.confirm(player, args[1], now) == null) {
                    send.accept(Reply("Use /lomphone link and click its current warning first."))
                } else {
                    bridge.issue(player) { message ->
                        send.accept(Reply(message, offerClearChat = true))
                    }
                }
            }
            else -> send.accept(Reply("Usage: /lomphone link"))
        }
    }

    fun forget(player: UUID) {
        confirmations.forget(player)
        bridge.forget(player)
    }
}
