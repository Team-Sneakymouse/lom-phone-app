package tv.rawb.lomphone;

import java.security.SecureRandom;
import java.util.*;

/** Main-thread-owned confirmation state. Raw linking codes are not generated here. */
public final class LinkFlow {
  private record Warning(String nonce, long expires) {}

  private final Map<UUID, Warning> warnings = new HashMap<>();
  private final SecureRandom random = new SecureRandom();

  public String warn(UUID player, long now) {
    byte[] bytes = new byte[24];
    random.nextBytes(bytes);
    String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    warnings.put(player, new Warning(nonce, now + 60_000));
    return nonce;
  }

  public void forget(UUID player) {
    warnings.remove(player);
  }

  public UUID confirm(UUID player, String nonce, long now) {
    Warning warning = warnings.get(player);
    if (warning == null || !warning.nonce().equals(nonce)) return null;
    warnings.remove(player);
    return now < warning.expires() ? player : null;
  }
}
