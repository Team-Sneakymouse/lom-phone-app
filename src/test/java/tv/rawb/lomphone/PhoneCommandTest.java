package tv.rawb.lomphone;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class PhoneCommandTest {
  @Test
  void logoutInvalidatesConfirmation() {
    FakeApi api = new FakeApi();
    Bridge bridge =
        new Bridge(api, Runnable::run, () -> 1000, "codes", "steps", 300000, 30000, 90000, 2);
    PhoneCommand command = new PhoneCommand(bridge);
    UUID player = UUID.randomUUID();
    List<PhoneCommand.Reply> replies = new ArrayList<>();
    command.execute(player, true, new String[] {"link"}, replies::add, 1000);
    String nonce = replies.getFirst().clickCommand().substring("/lomphone confirm ".length());
    command.forget(player);
    command.execute(player, true, new String[] {"confirm", nonce}, replies::add, 1001);
    assertEquals(0, api.writes);
  }

  @Test
  void consoleAndPermissionDeniedCannotEvenGetWarning() {
    FakeApi api = new FakeApi();
    Bridge bridge =
        new Bridge(api, Runnable::run, () -> 1000, "codes", "steps", 300000, 30000, 90000, 2);
    PhoneCommand command = new PhoneCommand(bridge);
    List<PhoneCommand.Reply> replies = new ArrayList<>();
    command.execute(null, true, new String[] {"link"}, replies::add, 1000);
    command.execute(UUID.randomUUID(), false, new String[] {"link"}, replies::add, 1000);
    assertEquals(2, replies.size());
    assertTrue(replies.stream().allMatch(r -> r.clickCommand() == null));
    assertEquals(0, api.writes);
  }

  @Test
  void linkWarnsPrivatelyAndClickAloneCanPersist() {
    FakeApi api = new FakeApi();
    List<Runnable> main = new ArrayList<>();
    Bridge bridge =
        new Bridge(api, main::add, () -> 1000, "codes", "steps", 300000, 30000, 90000, 2);
    PhoneCommand command = new PhoneCommand(bridge);
    UUID player = UUID.randomUUID();
    List<PhoneCommand.Reply> replies = new ArrayList<>();
    command.execute(player, true, new String[] {"confirm", "invented"}, replies::add, 1000);
    assertEquals(0, api.writes);
    replies.clear();
    command.execute(player, true, new String[] {"link"}, replies::add, 1000);
    assertEquals(0, api.writes);
    assertEquals(1, replies.size());
    assertTrue(replies.getFirst().text().contains("secret"));
    String click = replies.getFirst().clickCommand();
    assertTrue(click.startsWith("/lomphone confirm "));
    String nonce = click.substring("/lomphone confirm ".length());
    command.execute(player, true, new String[] {"confirm", nonce}, replies::add, 1001);
    assertEquals(1, api.writes);
    command.execute(player, true, new String[] {"confirm", nonce}, replies::add, 1002);
    assertEquals(1, api.writes);
    api.write.complete("{}");
    main.forEach(Runnable::run);
    assertTrue(replies.stream().anyMatch(r -> r.text().startsWith("Private linking code:")));
  }
}
