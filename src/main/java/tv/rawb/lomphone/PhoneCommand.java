package tv.rawb.lomphone;

import java.util.UUID;
import java.util.function.Consumer;

/** Private response routing; the adapter must send every reply only to the sender. */
public final class PhoneCommand {
  public record Reply(String text, String clickCommand) {}

  private final Bridge bridge;
  private final LinkFlow confirmations = new LinkFlow();

  public PhoneCommand(Bridge bridge) {
    this.bridge = bridge;
  }

  public void execute(UUID player, boolean allowed, String[] args, Consumer<Reply> send, long now) {
    if (player == null) {
      send.accept(new Reply("Only players can use this command.", null));
      return;
    }
    if (!allowed) {
      send.accept(new Reply("You do not have permission to link a phone.", null));
      return;
    }
    if (args.length == 1 && args[0].equalsIgnoreCase("link")) {
      String nonce = confirmations.warn(player, now);
      send.accept(
          new Reply(
              "Keep your linking code secret. Never share it in chat or screenshots. Click to"
                  + " create a private code (short-lived).",
              "/lomphone confirm " + nonce));
    } else if (args.length == 2 && args[0].equalsIgnoreCase("confirm")) {
      if (confirmations.confirm(player, args[1], now) == null)
        send.accept(new Reply("Use /lomphone link and click its current warning first.", null));
      else bridge.issue(player, message -> send.accept(new Reply(message, null)));
    } else send.accept(new Reply("Usage: /lomphone link", null));
  }

  public void forget(UUID player) {
    confirmations.forget(player);
    bridge.forget(player);
  }
}
