package tv.rawb.lomphone;

import static org.junit.jupiter.api.Assertions.*;

import org.bukkit.plugin.java.JavaPlugin;
import org.junit.jupiter.api.Test;

class ArtifactContractTest {
  @Test
  void jarHasPaperEntrypointAndRequiredJoinedManagerDependency() throws Exception {
    var resource = getClass().getResourceAsStream("/paper-plugin.yml");
    assertNotNull(resource);
    String yaml = new String(resource.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(yaml.contains("SneakyPocketbase:"));
    assertTrue(yaml.contains("required: true"));
    assertTrue(yaml.contains("join-classpath: true"));
    assertTrue(yaml.contains("load: BEFORE"));
    assertTrue(yaml.contains("api-version: '26.2'"));
    assertTrue(JavaPlugin.class.isAssignableFrom(Class.forName("tv.rawb.lomphone.LoMPhonePlugin")));
  }
}
