package com.lomphone.util

import java.security.SecureRandom

/** Crockford base32 helpers for short, typed linking codes (no check symbol). */
object Crockford {
    /** Alphabet excludes I, L, O, U to reduce transcription errors. */
    const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    /** Default issued code length: 10 chars ≈ 50 bits of entropy. */
    const val LINK_CODE_LENGTH = 10

    private val CHAR_PATTERN = Regex("^[${ALPHABET}]{$LINK_CODE_LENGTH}$")

    fun isLinkCode(value: String): Boolean = CHAR_PATTERN.matches(value)

    /** Encode uniformly random bits into exactly [length] Crockford characters. */
    fun encodeRandom(random: SecureRandom, length: Int = LINK_CODE_LENGTH): String {
        require(length > 0) { "length must be positive" }
        val bitsNeeded = length * 5
        val bytes = ByteArray((bitsNeeded + 7) / 8)
        random.nextBytes(bytes)
        val out = CharArray(length)
        var bitBuffer = 0
        var bitCount = 0
        var byteIndex = 0
        for (i in 0 until length) {
            while (bitCount < 5) {
                bitBuffer = (bitBuffer shl 8) or (bytes[byteIndex++].toInt() and 0xff)
                bitCount += 8
            }
            bitCount -= 5
            out[i] = ALPHABET[(bitBuffer ushr bitCount) and 0x1f]
        }
        return String(out)
    }
}
