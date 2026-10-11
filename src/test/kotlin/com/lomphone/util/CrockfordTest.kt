package com.lomphone.util

import java.security.SecureRandom
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class CrockfordTest {
    @Test
    fun linkCodesAreFixedLengthCrockfordAlphabet() {
        val random = SecureRandom()
        repeat(50) {
            val code = Crockford.encodeRandom(random)
            assertEquals(Crockford.LINK_CODE_LENGTH, code.length)
            assertTrue(Crockford.isLinkCode(code))
            assertFalse(code.any { it in "ILOUilou" })
        }
    }

    @Test
    fun rejectsWrongLengthOrAmbiguousLetters() {
        assertFalse(Crockford.isLinkCode("012345678")) // too short
        assertFalse(Crockford.isLinkCode("01234567890")) // too long
        assertFalse(Crockford.isLinkCode("012345678I")) // I not in alphabet
        assertFalse(Crockford.isLinkCode("012345678o")) // lowercase / O
    }
}
