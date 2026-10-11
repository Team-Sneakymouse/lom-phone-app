package com.lomphone.service

import java.security.SecureRandom
import java.util.Base64
import java.util.UUID

/** Main-thread-owned confirmation state. Raw linking codes are not generated here. */
class LinkFlow {
    private data class Warning(val nonce: String, val expires: Long)

    private val warnings = HashMap<UUID, Warning>()
    private val random = SecureRandom()

    fun warn(player: UUID, now: Long): String {
        val bytes = ByteArray(24)
        random.nextBytes(bytes)
        val nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        warnings[player] = Warning(nonce, now + 60_000)
        return nonce
    }

    fun forget(player: UUID) {
        warnings.remove(player)
    }

    fun confirm(player: UUID, nonce: String, now: Long): UUID? {
        val warning = warnings[player] ?: return null
        if (warning.nonce != nonce) return null
        warnings.remove(player)
        return if (now < warning.expires) player else null
    }
}
