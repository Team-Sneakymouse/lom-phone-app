package tv.rawb.lomphone;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Proxy;
import java.util.*;
import org.bukkit.OfflinePlayer;
import org.junit.jupiter.api.Test;

class StepsExpansionTest {
  @Test
  void papiExpansionIsCacheOnlyAndUnknownUntilFetchApplies() throws Exception {
    FakeApi api = new FakeApi();
    List<Runnable> main = new ArrayList<>();
    UUID id = UUID.randomUUID();
    Bridge bridge =
        new Bridge(api, main::add, () -> 1000, "codes", "steps", 300000, 30000, 90000, 2);
    OfflinePlayer player =
        (OfflinePlayer)
            Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[] {OfflinePlayer.class},
                (p, m, a) -> m.getName().equals("getUniqueId") ? id : null);
    Class<?> type = assertDoesNotThrow(() -> Class.forName("tv.rawb.lomphone.StepsExpansion"));
    var expansion =
        (me.clip.placeholderapi.expansion.PlaceholderExpansion)
            type.getConstructor(Bridge.class).newInstance(bridge);
    assertEquals("lomphone", expansion.getIdentifier());
    assertTrue(expansion.persist());
    assertEquals("unknown", expansion.onRequest(player, "steps"));
    assertEquals(0, api.reads);
    assertNull(expansion.onRequest(player, "other"));
    assertEquals("unknown", expansion.onRequest(null, "steps"));
    bridge.refresh(id);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + id + "\",\"total_steps\":5}"));
    main.forEach(Runnable::run);
    assertEquals("5", expansion.onRequest(player, "steps"));
    assertEquals(1, api.reads);
  }
}
