package tv.rawb.lomphone;

import static org.junit.jupiter.api.Assertions.*;

import com.google.gson.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class BridgeTest {
  private static String digest(String code) {
    try {
      return HexFormat.of()
          .formatHex(
              java.security.MessageDigest.getInstance("SHA-256")
                  .digest(code.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new AssertionError(impossible);
    }
  }

  @Test
  void unsafeCollectionNamesAndInvalidBoundsAreRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new Bridge(
                api, main::add, () -> now, "codes/secret", "steps", 300000, 30000, 90000, 2));
    assertThrows(
        IllegalArgumentException.class,
        () -> new Bridge(api, main::add, () -> now, "codes", "steps", 0, 30000, 90000, 2));
    assertThrows(
        IllegalArgumentException.class,
        () -> new Bridge(api, main::add, () -> now, "codes", "steps", 300000, 0, 90000, 2));
    assertThrows(
        IllegalArgumentException.class,
        () -> new Bridge(api, main::add, () -> now, "codes", "steps", 300000, 30000, 1000, 2));
    assertThrows(
        IllegalArgumentException.class,
        () -> new Bridge(api, main::add, () -> now, "codes", "steps", 300000, 30000, 90000, 0));
  }

  @Test
  void readinessLostBeforeWriteApplyDoesNotRevealCode() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.complete("{}");
    api.available = false;
    drain();
    assertTrue(messages.isEmpty());
  }

  @Test
  void codeAlreadyExpiredAtApplyTimeIsNotRevealed() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.complete("{}");
    now += 300_000;
    drain();
    assertFalse(messages.stream().anyMatch(x -> x.startsWith("Private linking code:")));
  }

  @Test
  void synchronousReadFailureDoesNotLeakOrExhaustSlots() {
    api.throwRead = true;
    assertDoesNotThrow(() -> bridge.refresh(player));
    api.throwRead = false;
    now += 30_000;
    bridge.refresh(player);
    api.read.complete(List.of());
    drain();
    bridge.refresh(UUID.randomUUID());
    assertEquals(2, api.reads);
  }

  @Test
  void synchronousFailureIsSanitizedAndReleasesWriteSlot() {
    api.throwWrite = true;
    List<String> messages = new ArrayList<>();
    assertDoesNotThrow(() -> bridge.issue(player, messages::add));
    assertEquals(List.of("Linking unavailable. Please try again later."), messages);
    api.throwWrite = false;
    bridge.issue(player, messages::add);
    assertEquals(1, api.writes);
  }

  @Test
  void writesAreGloballyBoundedEvenAcrossPlayers() {
    bridge.issue(player, x -> {});
    bridge.issue(UUID.randomUUID(), x -> {});
    bridge.issue(UUID.randomUUID(), x -> {});
    assertEquals(2, api.writes);
  }

  @Test
  void logoutAndRejoinCannotApplyPreviousSessionRead() {
    bridge.refresh(player);
    var old = api.read;
    bridge.forget(player);
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":8}"));
    drain();
    old.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":1}"));
    drain();
    assertEquals("8", bridge.placeholder(player));
  }

  @Test
  void stoppedOrOfflineServiceNeverFetchesOrAppliesSteps() {
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":3}"));
    bridge.stop();
    drain();
    bridge.refresh(UUID.randomUUID());
    assertEquals("unknown", bridge.placeholder(player));
    assertEquals(1, api.reads);
  }

  @Test
  void refreshIsRateLimitedButGenerationRecoveryBypassesDelay() {
    bridge.refresh(player);
    api.read.complete(List.of());
    drain();
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    assertEquals(1, api.reads);
    now += 30_000;
    bridge.refresh(player);
    assertEquals(2, api.reads);
    api.generation++;
    bridge.refresh(player);
    assertEquals(3, api.reads);
  }

  @Test
  void readConcurrencyIsBoundedAndSamePlayerDoesNotOverlap() {
    bridge.refresh(player);
    bridge.refresh(player);
    bridge.refresh(UUID.randomUUID());
    bridge.refresh(UUID.randomUUID());
    assertEquals(2, api.reads);
  }

  @Test
  void oldReadCompletingAfterNewGenerationDoesNotOverwriteRecovery() {
    bridge.refresh(player);
    var old = api.read;
    api.generation++;
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":9}"));
    drain();
    old.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":2}"));
    drain();
    assertEquals("9", bridge.placeholder(player));
  }

  @Test
  void offlineAndGenerationChangesInvalidateCacheBeforeRecovery() {
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":3}"));
    drain();
    api.available = false;
    assertEquals("unknown", bridge.placeholder(player));
    api.generation++;
    api.available = true;
    assertEquals("unknown", bridge.placeholder(player));
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":4}"));
    drain();
    assertEquals("4", bridge.placeholder(player));
  }

  @Test
  void staleTotalsBecomeUnknownWithoutBlocking() {
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":3}"));
    drain();
    assertEquals("3", bridge.placeholder(player));
    now += 90_000;
    assertEquals("unknown", bridge.placeholder(player));
  }

  @Test
  void uuidMustMatchAndExplicitZeroIsNotUnknown() {
    bridge.refresh(player);
    api.read.complete(
        List.of("{\"minecraft_uuid\":\"" + UUID.randomUUID() + "\",\"total_steps\":0}"));
    drain();
    assertEquals("unknown", bridge.placeholder(player));
    now += 30_000;
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":0}"));
    drain();
    assertEquals("0", bridge.placeholder(player));
  }

  @Test
  void malformedNegativeFractionalAndDuplicateStepsAreUnknown() {
    String[] invalid = {
      "not json",
      "{}",
      "{\"total_steps\":-1}",
      "{\"total_steps\":1.5}",
      "{\"total_steps\":\"2\"}",
      "{\"total_steps\":true}",
      "{\"total_steps\":9007199254740992}"
    };
    for (String record : invalid) {
      now += 30_000;
      api.read = new java.util.concurrent.CompletableFuture<>();
      bridge.refresh(player);
      String json =
          record.startsWith("{")
              ? record.replace("{", "{\"minecraft_uuid\":\"" + player + "\",")
              : record;
      api.read.complete(List.of(json));
      assertDoesNotThrow(this::drain);
      assertEquals("unknown", bridge.placeholder(player));
    }
    now += 30_000;
    api.read = new java.util.concurrent.CompletableFuture<>();
    bridge.refresh(player);
    api.read.complete(List.of("{\"total_steps\":1}", "{\"total_steps\":2}"));
    drain();
    assertEquals("unknown", bridge.placeholder(player));
  }

  @Test
  void stepsAreFetchedByUuidAndPlaceholdersNeverWaitForNetwork() {
    bridge.refresh(player);
    assertEquals(1, api.reads);
    assertEquals("minecraft_uuid = '" + player + "'", api.filter);
    assertEquals("unknown", bridge.placeholder(player));
    api.read.complete(List.of("{\"minecraft_uuid\":\"" + player + "\",\"total_steps\":42}"));
    assertEquals("unknown", bridge.placeholder(player));
    drain();
    assertEquals("42", bridge.placeholder(player));
  }

  @Test
  void leavingPlayerCannotReceiveQueuedCode() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.complete("{}");
    bridge.forget(player);
    drain();
    assertTrue(messages.isEmpty());
  }

  @Test
  void unavailableApiRejectsCodeWithoutNetworkOrSecret() {
    api.available = false;
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    assertEquals(0, api.writes);
    assertEquals(List.of("Linking unavailable. Please try again later."), messages);
  }

  @Test
  void stoppedBridgeDropsQueuedWriteAndRejectsNewWork() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.complete("{}");
    bridge.stop();
    drain();
    bridge.issue(UUID.randomUUID(), messages::add);
    assertTrue(messages.isEmpty());
    assertEquals(1, api.writes);
  }

  final FakeApi api = new FakeApi();
  final List<Runnable> main = new ArrayList<>();
  long now = 1_000;
  final UUID player = UUID.randomUUID();
  final Bridge bridge =
      new Bridge(
          api,
          main::add,
          () -> now,
          "phone_link_codes",
          "phone_player_steps",
          300_000,
          30_000,
          90_000,
          2);

  void drain() {
    var jobs = List.copyOf(main);
    main.clear();
    jobs.forEach(Runnable::run);
  }

  @Test
  void oldGenerationWriteCannotRevealCodeAfterScheduledCompletion() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.complete("{}");
    api.generation++;
    drain();
    assertTrue(messages.isEmpty());
  }

  @Test
  void repeatedConfirmationWhileWriteInFlightDoesNotCreateAnotherCode() {
    bridge.issue(player, ignored -> {});
    bridge.issue(player, ignored -> {});
    assertEquals(1, api.writes);
  }

  @Test
  void failedWritesNeverRevealCodeOrRetry() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    api.write.completeExceptionally(new RuntimeException("secret backend response"));
    drain();
    assertEquals(List.of("Linking unavailable. Please try again later."), messages);
    assertEquals(1, api.writes);
  }

  @Test
  void codeOnlyDisplayedAfterPersistenceAndOnlyDigestStored() {
    List<String> messages = new ArrayList<>();
    bridge.issue(player, messages::add);
    assertEquals(1, api.writes);
    assertTrue(messages.isEmpty());
    JsonObject record = JsonParser.parseString(api.json).getAsJsonObject();
    assertEquals(player.toString(), record.get("minecraft_uuid").getAsString());
    assertTrue(record.get("code_digest").getAsString().matches("[a-f0-9]{64}"));
    api.write.complete("{}");
    assertTrue(messages.isEmpty());
    drain();
    assertEquals(1, messages.size());
    assertTrue(messages.getFirst().startsWith("Private linking code: "));
    String code = messages.getFirst().substring("Private linking code: ".length());
    assertTrue(code.matches("[A-Za-z0-9_-]{43}"));
    assertFalse(api.json.contains(code));
    assertEquals(digest(code), record.get("code_digest").getAsString());
    assertEquals(
        300_000,
        java.time.Duration.between(
                java.time.Instant.parse(record.get("created_at").getAsString()),
                java.time.Instant.parse(record.get("expires_at").getAsString()))
            .toMillis());
  }
}
