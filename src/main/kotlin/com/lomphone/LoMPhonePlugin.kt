package com.lomphone

import com.danidipp.sneakypocketbase.PocketbaseProvider
import com.lomphone.command.PhoneCommand
import com.lomphone.expansion.StepsExpansion
import com.lomphone.service.Bridge
import io.papermc.paper.command.brigadier.BasicCommand
import io.papermc.paper.command.brigadier.CommandSourceStack
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents
import java.util.ArrayList
import java.util.Collections
import java.util.UUID
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.event.ClickEvent
import net.kyori.adventure.text.format.NamedTextColor
import org.bukkit.Bukkit
import org.bukkit.entity.Player
import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.plugin.IllegalPluginAccessException
import org.bukkit.plugin.java.JavaPlugin

open class LoMPhonePlugin : JavaPlugin(), Listener {
    companion object {
        const val IDENTIFIER = "lomphone"
        private const val CLEAR_CHAT_LINES = 100
    }

    private var unregisterExpansion: () -> Unit = {}
    private var bridge: Bridge? = null
    private var command: PhoneCommand? = null
    @Volatile private var accepting = false
    private var cursor = 0

    override fun onEnable() {
        saveDefaultConfig()
        val created =
            try {
                Bridge(
                    PocketbaseProvider.getApi(),
                    ::onMain,
                    { System.currentTimeMillis() },
                    config.getString("collections.link-codes", "phone_link_codes")!!,
                    config.getString("collections.player-steps", "phone_player_steps")!!,
                    config.getLong("code-ttl-seconds", 300) * 1000,
                    config.getLong("refresh-seconds", 30) * 1000,
                    config.getLong("stale-seconds", 90) * 1000,
                    config.getInt("max-concurrent-requests", 8),
                )
            } catch (_: IllegalArgumentException) {
                logger.severe(
                    "Invalid bridge configuration; plugin disabled. Check config bounds in README.",
                )
                Bukkit.getPluginManager().disablePlugin(this)
                return
            } catch (missing: IllegalStateException) {
                logger.severe("${missing.message}; plugin disabled.")
                Bukkit.getPluginManager().disablePlugin(this)
                return
            }
        bridge = created
        val phoneCommand = PhoneCommand(created)
        command = phoneCommand
        accepting = true
        lifecycleManager.registerEventHandler(LifecycleEvents.COMMANDS) { event ->
            event.registrar().register(
                "lomphone",
                "Create a private phone linking code",
                object : BasicCommand {
                    override fun execute(source: CommandSourceStack, args: Array<out String>) {
                        val sender = source.sender
                        if (args.size == 1 && args[0].equals("clearchat", ignoreCase = true)) {
                            val player = sender as? Player
                            if (player != null) clearChat(player)
                            else sender.sendMessage(Component.text("Only players can clear chat."))
                            return
                        }
                        val id = (sender as? Player)?.uniqueId
                        phoneCommand.execute(
                            id,
                            sender.hasPermission("lomphone.link"),
                            args,
                            { reply ->
                                var message = Component.text(reply.text)
                                val click = reply.clickCommand
                                if (click != null) {
                                    message =
                                        message.append(
                                            Component.text(" [Confirm]", NamedTextColor.YELLOW)
                                                .clickEvent(ClickEvent.runCommand(click)),
                                        )
                                }
                                if (reply.offerClearChat) {
                                    message =
                                        message.append(
                                            Component.text(" [Clear chat]", NamedTextColor.GRAY)
                                                .clickEvent(
                                                    ClickEvent.runCommand("/lomphone clearchat"),
                                                ),
                                        )
                                }
                                sender.sendMessage(message)
                            },
                            System.currentTimeMillis(),
                        )
                    }
                },
            )
        }
        Bukkit.getPluginManager().registerEvents(this, this)
        if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
            val expansion = StepsExpansion(created, pluginMeta.version)
            unregisterExpansion = expansion::unregister
            if (!expansion.register()) {
                logger.warning(
                    "Placeholder registration failed; phone linking remains available.",
                )
            }
        }
        // Poll only online UUIDs. No global scans, realtime registrations, or authentication callbacks.
        Bukkit.getScheduler().runTaskTimer(
            this,
            Runnable {
                val players = ArrayList(Bukkit.getOnlinePlayers())
                if (players.isNotEmpty()) {
                    Collections.rotate(players, -(cursor++ % players.size))
                    players.forEach { player -> created.refresh(player.uniqueId) }
                }
            },
            1L,
            20L,
        )
    }

    private fun onMain(work: Runnable) {
        if (!accepting) return
        try {
            Bukkit.getScheduler().runTask(
                this,
                Runnable {
                    if (accepting) work.run()
                },
            )
        } catch (_: IllegalPluginAccessException) {
            /* shutdown: discard work */
        }
    }

    /** Client chat has no clear API; push blank lines so prior messages scroll off. */
    private fun clearChat(player: Player) {
        val blank = Component.text(" ")
        repeat(CLEAR_CHAT_LINES) { player.sendMessage(blank) }
    }

    @EventHandler
    fun onJoin(event: PlayerJoinEvent) {
        bridge?.refresh(event.player.uniqueId)
    }

    @EventHandler
    fun onQuit(event: PlayerQuitEvent) {
        command?.forget(event.player.uniqueId)
    }

    override fun onDisable() {
        accepting = false
        bridge?.stop()
        unregisterExpansion()
        Bukkit.getScheduler().cancelTasks(this)
    }
}
