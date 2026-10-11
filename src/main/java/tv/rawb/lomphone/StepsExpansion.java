package tv.rawb.lomphone;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;

/** No network calls and no Bukkit online-player lookup in placeholder rendering. */
public final class StepsExpansion extends PlaceholderExpansion {
  private final Bridge bridge;

  public StepsExpansion(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public String getIdentifier() {
    return "lomphone";
  }

  @Override
  public String getAuthor() {
    return "Team-Sneakymouse";
  }

  @Override
  public String getVersion() {
    return "0.1.0";
  }

  @Override
  public boolean persist() {
    return true;
  }

  @Override
  public String onRequest(OfflinePlayer player, String params) {
    if (!params.equalsIgnoreCase("steps")) return null;
    return player == null ? "unknown" : bridge.placeholder(player.getUniqueId());
  }
}
