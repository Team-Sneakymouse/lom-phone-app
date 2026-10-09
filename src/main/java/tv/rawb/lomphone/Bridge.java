package tv.rawb.lomphone;

import com.danidipp.sneakypocketbase.*;
import com.google.gson.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.function.*;

/** Main-thread service; executor must enqueue on the Paper main thread. */
public final class Bridge {
  private final PocketbaseApi api;
  private final Consumer<Runnable> main;
  private final LongSupplier clock;
  private final String links, steps;
  private final long codeTtl, refresh, stale;
  private final int maxRequests;
  private volatile boolean enabled = true;

  private record Attempt(long at, long generation) {}

  private final Map<UUID, Attempt> attempts = new HashMap<>();

  private record ReadJob(long generation, Object identity) {}

  private final Map<UUID, ReadJob> reading = new HashMap<>();
  private int activeReads;

  private record Total(String value, long fetchedAt, long generation) {}

  private final java.util.concurrent.ConcurrentMap<UUID, Total> cache =
      new java.util.concurrent.ConcurrentHashMap<>();
  private final Map<UUID, Object> deliveries = new HashMap<>();
  private final Set<UUID> writing = new HashSet<>();
  private final SecureRandom random = new SecureRandom();

  public Bridge(
      PocketbaseApi api,
      Consumer<Runnable> main,
      LongSupplier clock,
      String links,
      String steps,
      long codeTtl,
      long refresh,
      long stale,
      int maxRequests) {
    if (links == null
        || steps == null
        || !links.matches("[a-zA-Z][a-zA-Z0-9_]{0,63}")
        || !steps.matches("[a-zA-Z][a-zA-Z0-9_]{0,63}")
        || codeTtl < 30_000
        || codeTtl > 900_000
        || refresh < 5_000
        || refresh > 300_000
        || stale < refresh
        || stale > 900_000
        || maxRequests < 1
        || maxRequests > 64) {
      throw new IllegalArgumentException("Invalid bridge configuration");
    }
    this.api = api;
    this.main = main;
    this.clock = clock;
    this.links = links;
    this.steps = steps;
    this.codeTtl = codeTtl;
    this.refresh = refresh;
    this.stale = stale;
    this.maxRequests = maxRequests;
  }

  public void issue(UUID player, Consumer<String> result) {
    if (!enabled) return;
    if (api.getLifecycleSnapshot().getApiState()
        != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE) {
      result.accept("Linking unavailable. Please try again later.");
      return;
    }
    if (writing.size() >= maxRequests || !writing.add(player)) {
      result.accept("Linking unavailable. Please try again later.");
      return;
    }
    Object delivery = new Object();
    deliveries.put(player, delivery);
    long generation = api.getLifecycleSnapshot().getGeneration();
    long expires = clock.getAsLong() + codeTtl;
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    String digest;
    try {
      digest =
          HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(code.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new AssertionError(impossible);
    }
    JsonObject record = new JsonObject();
    record.addProperty("minecraft_uuid", player.toString());
    record.addProperty("code_digest", digest);
    record.addProperty("created_at", Instant.ofEpochMilli(clock.getAsLong()).toString());
    record.addProperty("expires_at", Instant.ofEpochMilli(expires).toString());
    try {
      api.create(links, record.toString())
          .whenComplete(
              (saved, failure) ->
                  main.accept(
                      () -> {
                        writing.remove(player);
                        if (!deliveries.remove(player, delivery)) return;
                        if (!enabled
                            || api.getLifecycleSnapshot().getApiState()
                                != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
                            || api.getLifecycleSnapshot().getGeneration() != generation) return;
                        result.accept(
                            failure == null && clock.getAsLong() < expires
                                ? "Private linking code: " + code
                                : "Linking unavailable. Please try again later.");
                      }));
    } catch (RuntimeException failure) {
      writing.remove(player);
      deliveries.remove(player);
      result.accept("Linking unavailable. Please try again later.");
    }
  }

  public void refresh(UUID player) {
    if (!enabled
        || api.getLifecycleSnapshot().getApiState()
            != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE) return;
    long started = clock.getAsLong();
    long generation = api.getLifecycleSnapshot().getGeneration();
    if (activeReads >= maxRequests
        || (reading.containsKey(player) && reading.get(player).generation() == generation)) return;
    Attempt last = attempts.get(player);
    if (last != null && last.generation() == generation && started - last.at() < refresh) return;
    attempts.put(player, new Attempt(started, generation));
    ReadJob job = new ReadJob(generation, new Object());
    reading.put(player, job);
    activeReads++;
    try {
      api.getFullList(steps, 2, "", "minecraft_uuid = '" + player + "'")
          .whenComplete(
              (records, failure) ->
                  main.accept(
                      () -> {
                        activeReads--;
                        if (!reading.remove(player, job)) return;
                        if (!enabled
                            || api.getLifecycleSnapshot().getApiState()
                                != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
                            || api.getLifecycleSnapshot().getGeneration() != generation) return;
                        String value = failure == null ? parseSteps(player, records) : null;
                        if (value == null) cache.remove(player);
                        else cache.put(player, new Total(value, started, generation));
                      }));
    } catch (RuntimeException failure) {
      activeReads--;
      reading.remove(player, job);
      cache.remove(player);
    }
  }

  private static String parseSteps(UUID player, List<String> records) {
    if (records == null || records.size() != 1) return null;
    try {
      JsonObject record = JsonParser.parseString(records.getFirst()).getAsJsonObject();
      if (!player.toString().equals(record.get("minecraft_uuid").getAsString())) return null;
      JsonElement value = record.get("total_steps");
      if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber())
        return null;
      long total = value.getAsBigDecimal().longValueExact();
      return total >= 0 && total <= 9_007_199_254_740_991L ? Long.toString(total) : null;
    } catch (RuntimeException malformed) {
      return null;
    }
  }

  public String placeholder(UUID player) {
    PocketbaseLifecycleSnapshot snapshot = api.getLifecycleSnapshot();
    Total total = cache.get(player);
    return !enabled
            || snapshot.getApiState() != PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
            || total == null
            || total.generation() != snapshot.getGeneration()
            || clock.getAsLong() - total.fetchedAt() >= stale
        ? "unknown"
        : total.value();
  }

  public void forget(UUID player) {
    deliveries.remove(player);
    reading.remove(player);
    attempts.remove(player);
    cache.remove(player);
  }

  public void stop() {
    enabled = false;
  }
}
