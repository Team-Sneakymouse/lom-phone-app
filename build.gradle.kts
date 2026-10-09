import java.net.URI
import java.security.MessageDigest
import java.util.zip.ZipFile
import xyz.jpenilla.runtask.service.DownloadsAPIService

plugins {
    java
    id("xyz.jpenilla.run-paper") version "3.1.0"
}
group = "tv.rawb.lomphone"
version = "0.1.0"
repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://repo.extendedclip.com/releases/")
}
java { toolchain.languageVersion.set(JavaLanguageVersion.of(25)) }
val managerApi = sourceSets.create("managerApi")
val managerRevision = "0b5c895f3cab2eb87db3565c435a5c945c03e92a"
val apiSourceHashes = mapOf(
        "AsyncPocketbaseEvent.java" to "ea39d8f05c74293a859c014acf5ea0b2163a63d9e4c497096f89b20c3a8694ad",
        "AsyncPocketbaseLifecycleEvent.java" to "6527ad90a5ec86a872ce2210c7c496fa5914c17aafb7023eb9dfb2c4dd2f663f",
        "PocketbaseApi.java" to "20d15f4a47b8c0aeea9a9410ac92ea848d925ec2c4020fd9db1f307cc1a01fed",
        "PocketbaseLifecycleSnapshot.java" to "564be3543213f9cc0e960c2cbb75c9aa08757f565ab0ad33451fe3957f6fc8d9",
        "PocketbaseProvider.java" to "f6dc95d25067d32078c28fa85ab72018598867c281923c3d675d5f6a27f7800f"
)
val apiSourceDirectory = layout.buildDirectory.dir("generated/managerApi")
val fetchManagerApi = tasks.register("fetchManagerApi") {
    inputs.property("revision", managerRevision)
    inputs.property("hashes", apiSourceHashes)
    outputs.dir(apiSourceDirectory)
    doLast {
        val target = apiSourceDirectory.get().asFile.resolve("com/danidipp/sneakypocketbase")
        target.mkdirs()
        apiSourceHashes.forEach { (name, expected) ->
            val url = URI("https://raw.githubusercontent.com/Team-Sneakymouse/SneakyPocketbase/$managerRevision/src/main/java/com/danidipp/sneakypocketbase/$name").toURL()
            val connection = url.openConnection().apply { connectTimeout = 15000; readTimeout = 30000 }
            val bytes = connection.getInputStream().use { it.readBytes() }
            val actual = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            check(actual == expected) { "Upstream API source checksum mismatch: $name" }
            target.resolve(name).writeBytes(bytes)
        }
    }
}
managerApi.java.setSrcDirs(listOf(apiSourceDirectory))
tasks.named(managerApi.compileJavaTaskName) { dependsOn(fetchManagerApi) }

dependencies { add(managerApi.compileOnlyConfigurationName, "io.papermc.paper:paper-api:26.2.build.132-stable") }
dependencies {
    compileOnly("io.papermc.paper:paper-api:26.2.build.132-stable")
    compileOnly("me.clip:placeholderapi:2.11.6")
    testImplementation("me.clip:placeholderapi:2.11.6")
    compileOnly(managerApi.output)
    // Paper API pins and supplies Gson 2.14.0 at runtime.
    testImplementation(managerApi.output)
    testImplementation("io.papermc.paper:paper-api:26.2.build.132-stable")
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
tasks.test { useJUnitPlatform(); testLogging { events("passed", "failed", "skipped") } }
// Gson is supplied by Paper. No manager classes or libraries are bundled.
tasks.runServer { minecraftVersion("26.2"); build(132) }
val validateRunServer = tasks.register("validateRunServer") {
    group = "verification"
    description = "Validate pinned runServer configuration without starting Minecraft."
    doLast {
        val server = tasks.runServer.get()
        check(server.version.get() == "26.2")
        check(server.build.get() == DownloadsAPIService.Build.Specific(132))
        check(server.javaLauncher.get().metadata.languageVersion.asInt() == 25)
        println("runServer validated: Paper 26.2 build 132, Java 25 (server not started)")
    }
}
val verifyBridgeArtifact = tasks.register("verifyBridgeArtifact") {
    group = "verification"
    dependsOn(tasks.jar)
    doLast {
        ZipFile(tasks.jar.get().archiveFile.get().asFile).use { zip ->
            val names = zip.entries().asSequence().map { it.name }.toList()
            check("paper-plugin.yml" in names && "config.yml" in names)
            check("tv/rawb/lomphone/LoMPhonePlugin.class" in names)
            check(names.none { it.startsWith("com/danidipp/") || it.startsWith("kotlin/") || it.startsWith("kotlinx/") || it.startsWith("me/clip/") || it.startsWith("com/google/gson/") })
        }
        println("Bridge artifact verified: descriptors present, no manager/PAPI/Gson/Kotlin classes bundled")
    }
}
tasks.check { dependsOn(validateRunServer, verifyBridgeArtifact) }
