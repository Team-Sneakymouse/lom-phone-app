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
    maven("https://maven.sneakyrp.com/releases/") {
        content { includeGroup("io.github.team-sneakymouse") }
    }
}
java { toolchain.languageVersion.set(JavaLanguageVersion.of(25)) }
val managerApi = "io.github.team-sneakymouse:sneakypocketbase-api:2026.10.09-0233c4a041d5"
dependencies {
    compileOnly("io.papermc.paper:paper-api:26.2.build.132-stable")
    compileOnly("me.clip:placeholderapi:2.11.6")
    testImplementation("me.clip:placeholderapi:2.11.6")
    compileOnly(managerApi)
    // Paper API pins and supplies Gson 2.14.0 at runtime.
    testImplementation(managerApi)
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
