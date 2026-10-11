package com.lomphone.expansion

import com.lomphone.service.Bridge
import me.clip.placeholderapi.expansion.PlaceholderExpansion
import org.bukkit.OfflinePlayer

/** No network calls and no Bukkit online-player lookup in placeholder rendering. */
class StepsExpansion(
    private val bridge: Bridge,
    private val pluginVersion: String,
) : PlaceholderExpansion() {
    override fun getIdentifier(): String = "lomphone"

    override fun getAuthor(): String = "Team-Sneakymouse"

    override fun getVersion(): String = pluginVersion

    override fun persist(): Boolean = true

    override fun onRequest(player: OfflinePlayer?, params: String): String? {
        if (!params.equals("steps", ignoreCase = true)) return null
        return if (player == null) "unknown" else bridge.placeholder(player.uniqueId)
    }
}
