import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.zip.ZipFile
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import xyz.jpenilla.runtask.service.DownloadsAPIService

plugins {
    kotlin("jvm") version "2.3.21"
    id("xyz.jpenilla.run-paper") version "3.1.0"
    `maven-publish`
}

group = "io.github.team-sneakymouse"

// Requires a git checkout with at least one commit (CI and local clones).
version =
    providers.exec {
        workingDir(rootDir)
        commandLine("git", "show", "-s", "--format=%ct:%h", "--abbrev=12", "HEAD")
    }.standardOutput.asText.map { commit ->
        val (timestamp, hash) = commit.trim().split(":", limit = 2)
        val date =
            DateTimeFormatter.ofPattern("yyyy.MM.dd").withZone(ZoneOffset.UTC)
                .format(Instant.ofEpochSecond(timestamp.toLong()))
        "$date-$hash"
    }.get()

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://repo.extendedclip.com/releases/")
    maven("https://maven.sneakyrp.com/releases") {
        content { includeGroup("io.github.team-sneakymouse") }
    }
}

val paperApi = "io.papermc.paper:paper-api:26.2.build.132-stable"
val managerApi = "io.github.team-sneakymouse:sneakypocketbase-api:2026.10.09-0233c4a041d5"
val mockBukkitVersion = "4.117.0"
val kotlinStdlib = "org.jetbrains.kotlin:kotlin-stdlib:2.3.21"

dependencies {
    compileOnly(paperApi)
    compileOnly("me.clip:placeholderapi:2.11.6")
    compileOnly(managerApi)
    implementation(kotlinStdlib)

    testImplementation(paperApi)
    testImplementation("me.clip:placeholderapi:2.11.6")
    testImplementation(managerApi)
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testImplementation("org.mockbukkit.mockbukkit:mockbukkit-v26.2:$mockBukkitVersion")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(25)
}

java {
    withSourcesJar()
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_25)
    }
}

tasks {
    processResources {
        inputs.property("version", project.version.toString())
        filesMatching("paper-plugin.yml") {
            expand("version" to project.version.toString())
        }
    }

    jar {
        archiveBaseName.set(rootProject.name)
        archiveFileName.set("${rootProject.name}-${project.version}.jar")
        from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) })
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    }

    test {
        useJUnitPlatform()
        testLogging { events("passed", "failed", "skipped") }
    }

    runServer {
        minecraftVersion("26.2")
        build(132)
        // Paper 26.2 world COW/filefix fails on NTFS/FUSE (this workspace lives under /mnt/files).
        // Keep server data on a native ext4 path; override with LOM_PHONE_RUN_DIR if needed.
        val override = System.getenv("LOM_PHONE_RUN_DIR")
        val directory =
            if (!override.isNullOrBlank()) {
                file(override)
            } else {
                file("${System.getProperty("user.home")}/.cache/lom-phone-bridge/run")
            }
        runDirectory.set(directory)
    }
}

val validateRunServer =
    tasks.register("validateRunServer") {
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

val verifyBridgeArtifact =
    tasks.register("verifyBridgeArtifact") {
        group = "verification"
        dependsOn(tasks.jar)
        doLast {
            ZipFile(tasks.jar.get().archiveFile.get().asFile).use { zip ->
                val names = zip.entries().asSequence().map { it.name }.toList()
                check("paper-plugin.yml" in names && "config.yml" in names)
                check("com/lomphone/LoMPhonePlugin.class" in names)
                check(names.any { it.startsWith("kotlin/") }) {
                    "kotlin-stdlib must be shaded into the plugin JAR"
                }
                check(
                    names.none {
                        it.startsWith("com/danidipp/") ||
                            it.startsWith("me/clip/") ||
                            it.startsWith("com/google/gson/")
                    },
                ) {
                    "manager/PAPI/Gson classes must not be bundled"
                }
            }
            println(
                "Bridge artifact verified: descriptors present, kotlin-stdlib shaded, no manager/PAPI/Gson",
            )
        }
    }

val publishPreflight =
    tasks.register<Exec>("publishPreflight") {
        group = "verification"
        description =
            "Catch sneakyrp publish footguns (gradlew mode, wrapper jar, workflow_dispatch)."
        workingDir = rootDir
        commandLine("bash", "scripts/publish-preflight.sh", rootDir.absolutePath)
    }

tasks.check {
    dependsOn(validateRunServer, verifyBridgeArtifact, publishPreflight)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            artifactId = "lom-phone-bridge"
            from(components["java"])
            pom {
                name.set("LoM Phone Bridge")
                description.set(
                    "Paper-to-PocketBase bridge for Lords of Minecraft phone linking and step totals.",
                )
                url.set("https://github.com/Team-Sneakymouse/lom-phone-app")
                licenses {
                    license {
                        name.set("GNU General Public License v3.0")
                        url.set("https://www.gnu.org/licenses/gpl-3.0.txt")
                    }
                }
                developers {
                    developer {
                        id.set("team-sneakymouse")
                        name.set("Team Sneakymouse")
                        url.set("https://github.com/Team-Sneakymouse")
                    }
                }
                scm {
                    url.set("https://github.com/Team-Sneakymouse/lom-phone-app")
                    connection.set("scm:git:https://github.com/Team-Sneakymouse/lom-phone-app.git")
                }
            }
        }
    }
    repositories {
        maven {
            name = "sneakyrp"
            url = uri("https://maven.sneakyrp.com/releases")
            credentials(PasswordCredentials::class)
            authentication {
                create<org.gradle.authentication.http.BasicAuthentication>("basic")
            }
        }
    }
}

tasks.withType<PublishToMavenRepository>().configureEach {
    dependsOn(tasks.check)
}
