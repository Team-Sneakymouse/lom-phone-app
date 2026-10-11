package com.lomphone

import org.bukkit.plugin.java.JavaPlugin
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ArtifactContractTest {
    @Test
    fun jarHasPaperEntrypointAndRequiredJoinedManagerDependency() {
        val resource = javaClass.getResourceAsStream("/paper-plugin.yml")
        assertNotNull(resource)
        val yaml = resource!!.readBytes().toString(Charsets.UTF_8)
        assertTrue(yaml.contains("SneakyPocketbase:"))
        assertTrue(yaml.contains("required: true"))
        assertTrue(yaml.contains("join-classpath: true"))
        assertTrue(yaml.contains("load: BEFORE"))
        assertTrue(yaml.contains("api-version: '26.2'"))
        assertTrue(yaml.contains("main: com.lomphone.LoMPhonePlugin"))
        assertTrue(JavaPlugin::class.java.isAssignableFrom(LoMPhonePlugin::class.java))
    }
}
