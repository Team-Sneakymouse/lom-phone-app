package tv.rawb.lomphone;

import com.danidipp.sneakypocketbase.*;
import java.util.*;
import java.util.concurrent.*;

final class FakeApi implements PocketbaseApi {
  boolean throwWrite, throwRead;
  long generation = 1;
  boolean available = true;
  int writes, reads;
  String json, filter;
  CompletableFuture<String> write = new CompletableFuture<>();
  CompletableFuture<List<String>> read = new CompletableFuture<>();

  public PocketbaseLifecycleSnapshot getLifecycleSnapshot() {
    return new PocketbaseLifecycleSnapshot(
        available
            ? PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
            : PocketbaseLifecycleSnapshot.ApiState.UNAVAILABLE,
        PocketbaseLifecycleSnapshot.TransportState.DISCONNECTED,
        Map.of(),
        generation,
        generation,
        "");
  }

  public void whenReady(Runnable r) {
    throw new UnsupportedOperationException();
  }

  public CompletableFuture<String> create(String c, String j) {
    if (throwWrite) throw new IllegalStateException("secret");
    writes++;
    json = j;
    return write;
  }

  public CompletableFuture<List<String>> getFullList(String c, int n, String s, String f) {
    if (throwRead) throw new IllegalStateException("secret");
    reads++;
    filter = f;
    return read;
  }

  public CompletableFuture<String> getOne(String c, String id) {
    throw new UnsupportedOperationException();
  }

  public CompletableFuture<String> update(String c, String id, String j) {
    throw new UnsupportedOperationException();
  }

  public CompletableFuture<Boolean> delete(String c, String id) {
    throw new UnsupportedOperationException();
  }

  public CompletableFuture<Void> subscribe(String c) {
    throw new UnsupportedOperationException();
  }

  public CompletableFuture<Void> unsubscribe(String c) {
    throw new UnsupportedOperationException();
  }
}
