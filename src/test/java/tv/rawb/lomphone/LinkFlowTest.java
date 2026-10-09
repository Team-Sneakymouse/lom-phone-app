package tv.rawb.lomphone;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class LinkFlowTest {
  @Test
  void expiredOrReplacedWarningCannotConfirm() {
    LinkFlow flow = new LinkFlow();
    UUID id = UUID.randomUUID();
    String old = flow.warn(id, 0);
    String current = flow.warn(id, 1);
    assertNull(flow.confirm(id, old, 2));
    assertNull(flow.confirm(id, current, 60_001));
  }

  @Test
  void warningDoesNotCreateCodeAndConfirmationWithoutWarningIsRejected() throws Exception {
    LinkFlow flow = new LinkFlow();
    UUID player = UUID.randomUUID();
    assertNull(flow.confirm(player, "anything", 0));
    String nonce = flow.warn(player, 0);
    assertNotNull(nonce);
    assertNull(flow.confirm(UUID.randomUUID(), nonce, 1));
    assertEquals(player, flow.confirm(player, nonce, 1));
    assertNull(flow.confirm(player, nonce, 2));
  }
}
