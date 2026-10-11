package com.lomphone

import com.danidipp.sneakypocketbase.PocketbaseApi
import com.danidipp.sneakypocketbase.PocketbaseLifecycleSnapshot
import java.util.concurrent.CompletableFuture

internal class FakeApi : PocketbaseApi {
    var throwWrite = false
    var throwRead = false
    var generation = 1L
    var available = true
    var writes = 0
    var reads = 0
    var json: String? = null
    var filter: String? = null
    var write: CompletableFuture<String> = CompletableFuture()
    var read: CompletableFuture<List<String>> = CompletableFuture()

    override fun getLifecycleSnapshot(): PocketbaseLifecycleSnapshot =
        PocketbaseLifecycleSnapshot(
            if (available) {
                PocketbaseLifecycleSnapshot.ApiState.AVAILABLE
            } else {
                PocketbaseLifecycleSnapshot.ApiState.UNAVAILABLE
            },
            PocketbaseLifecycleSnapshot.TransportState.DISCONNECTED,
            emptyMap(),
            generation,
            generation,
            "",
        )

    override fun whenReady(r: Runnable) {
        throw UnsupportedOperationException()
    }

    override fun create(c: String, j: String): CompletableFuture<String> {
        if (throwWrite) throw IllegalStateException("secret")
        writes++
        json = j
        return write
    }

    override fun getFullList(
        c: String,
        n: Int,
        s: String,
        f: String,
    ): CompletableFuture<List<String>> {
        if (throwRead) throw IllegalStateException("secret")
        reads++
        filter = f
        return read
    }

    override fun getOne(c: String, id: String): CompletableFuture<String> {
        throw UnsupportedOperationException()
    }

    override fun update(c: String, id: String, j: String): CompletableFuture<String> {
        throw UnsupportedOperationException()
    }

    override fun delete(c: String, id: String): CompletableFuture<Boolean> {
        throw UnsupportedOperationException()
    }

    override fun subscribe(c: String): CompletableFuture<Void> {
        throw UnsupportedOperationException()
    }

    override fun unsubscribe(c: String): CompletableFuture<Void> {
        throw UnsupportedOperationException()
    }
}
