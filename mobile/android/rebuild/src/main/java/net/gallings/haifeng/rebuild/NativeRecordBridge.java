package net.gallings.haifeng.rebuild;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** One Android file worker and one cached page receipt. No JavaScript interface or general file RPC. */
final class NativeRecordBridge implements AutoCloseable {
    private static final String START = "https://appassets.androidplatform.net/assets/game/index.html";
    private static final int MAX_REQUEST = 3 * 1024 * 1024;
    private static final int MAX_REPLY = MAX_REQUEST + 65536;
    private static final String READ_REQUEST = "(() => {if(window.top!==window||location.href!=="
            + "'https://appassets.androidplatform.net/assets/game/index.html')return null;"
            + "const b=window.__HAIFENG_RECORDS__;if(b?.protocol!=='haifeng.native-records/1')return null;"
            + "const q=b.readRequest();return typeof q==='string'&&q.length<=3145728?q:null;})()";
    private final WebView web;
    private final File root;
    private final String workId;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean closed = new AtomicBoolean();
    private final AtomicLong page = new AtomicLong();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(task -> new Thread(task, "haifeng-native-records"));
    private volatile boolean ready;
    // Main-thread fields. At most one evaluation and one worker task; reloads cannot grow the queue.
    private boolean working;
    private boolean observing;
    private long observation;
    private Runnable observationTimeout;
    private final Runnable poll = this::poll;
    // Worker-thread fields. A repeated immutable request may only retransmit this exact receipt.
    private NativeRecordStore store;
    private long receiptPage = -1;
    private String receiptOwner;
    private long receiptId;
    private String receiptRequest;
    private String receiptScript;

    NativeRecordBridge(WebView web, File root, String workId) {
        this.web = web; this.root = root; this.workId = workId;
    }

    void start(Runnable loaded, Consumer<String> failed) {
        worker.execute(() -> {
            if (closed.get()) return;
            try {
                store = NativeRecordStore.open(root, workId);
                handler.post(() -> { if (!closed.get()) loaded.run(); });
            } catch (NativeRecordStore.StorageError failure) {
                handler.post(() -> { if (!closed.get()) failed.accept(failure.code + "：" + failure.getMessage()); });
            } catch (RuntimeException failure) {
                handler.post(() -> { if (!closed.get()) failed.accept("原生文件记录初始化未完成，未切换其他存储来源。"); });
            }
        });
    }

    void pageStarted() {
        ready = false;
        page.incrementAndGet();
        observation++;
        observing = false;
        clearObservationTimeout();
        handler.removeCallbacks(poll);
        // The worker is not cancelled: a file commit already started may still complete.
    }

    void pageFinished() {
        if (closed.get() || !START.equals(web.getUrl())) return;
        ready = true;
        schedule();
    }

    private boolean current(long ownerPage) { return !closed.get() && ready && page.get() == ownerPage; }
    private void schedule() {
        handler.removeCallbacks(poll);
        if (!closed.get() && ready) handler.postDelayed(poll, 100);
    }
    private void clearObservationTimeout() {
        if (observationTimeout != null) handler.removeCallbacks(observationTimeout);
        observationTimeout = null;
    }

    private void poll() {
        if (closed.get() || !ready || observing || working || !START.equals(web.getUrl())) return;
        final long ownerPage = page.get();
        final long sample = ++observation;
        observing = true;
        observationTimeout = () -> {
            if (!current(ownerPage) || sample != observation || !observing) return;
            observing = false;
            observationTimeout = null;
            schedule();
        };
        handler.postDelayed(observationTimeout, 1000);
        try {
            web.evaluateJavascript(READ_REQUEST, answer -> {
                if (!current(ownerPage) || sample != observation || !observing) return;
                observing = false;
                clearObservationTimeout();
                if (answer == null || "null".equals(answer) || answer.length() > MAX_REQUEST * 6 + 32) { schedule(); return; }
                working = true;
                worker.execute(() -> {
                    String script = null;
                    try {
                        if (current(ownerPage)) script = handle(ownerPage, answer);
                    } catch (IllegalArgumentException invalid) {
                        // No validated identity means no operation and no guessed reply.
                        Log.w("HaifengRecords", "原生记录请求格式无效，未执行文件操作");
                    } finally {
                        final String result = script;
                        handler.post(() -> {
                            working = false;
                            if (current(ownerPage) && result != null && START.equals(web.getUrl())) {
                                try { web.evaluateJavascript(result, null); }
                                catch (RuntimeException unavailable) {
                                    // Keep cached receipt. The same page head will request it again.
                                }
                            }
                            schedule();
                        });
                    }
                });
            });
        } catch (RuntimeException unavailable) {
            observing = false;
            clearObservationTimeout();
            schedule();
        }
    }

    private String handle(long ownerPage, String answer) {
        String json = NativeRecordJson.string(answer);
        if (json.length() > MAX_REQUEST || bytes(json) > MAX_REQUEST || !current(ownerPage)) return null;
        Map<String, String> request = NativeRecordJson.object(json);
        fields(request, "format", "owner", "id", "workId", "operation");
        String owner = NativeRecordJson.string(request.get("owner"));
        long id = NativeRecordJson.generation(request.get("id"));
        if (!"haifeng.native-record-request/1".equals(NativeRecordJson.string(request.get("format")))
                || !workId.equals(NativeRecordJson.string(request.get("workId"))) || id < 1
                || !owner.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
            return null;
        }
        if (receiptPage != ownerPage) {
            receiptPage = ownerPage; receiptOwner = null; receiptId = 0;
            receiptRequest = null; receiptScript = null;
        }
        if (receiptOwner != null) {
            if (!receiptOwner.equals(owner)) return null;
            if (id <= receiptId) {
                if (id == receiptId && json.equals(receiptRequest)) return receiptScript;
                return script(failed(owner, id, "NATIVE_STORAGE_ID", "请求身份已使用或载荷改变，未重新执行；请确认原记录"));
            }
        }
        if (!current(ownerPage)) return null;
        String reply;
        try {
            Outcome outcome = execute(request.get("operation"), ownerPage);
            if (outcome == null) return null;
            reply = "{\"format\":\"haifeng.native-record-reply/1\",\"owner\":" + NativeRecordJson.quote(owner)
                    + ",\"id\":" + id + ",\"ok\":true,\"result\":" + outcome.result + ",\"warnings\":" + warnings(outcome.warnings) + "}";
        } catch (NativeRecordStore.StorageError failure) {
            reply = failed(owner, id, failure.code, failure.getMessage());
        } catch (IllegalArgumentException invalid) {
            reply = failed(owner, id, "NATIVE_STORAGE_REQUEST", invalid.getMessage());
        } catch (RuntimeException unconfirmed) {
            reply = failed(owner, id, "NATIVE_STORAGE_UNCONFIRMED", "原生操作未取得完整确认，可能已提交，请查看原记录或显式重试原操作");
        }
        // Cache even a failed/unencodable receipt. Never execute this request again to repair delivery.
        receiptOwner = owner; receiptId = id; receiptRequest = json;
        receiptScript = bytes(reply) <= MAX_REPLY ? script(reply) : null;
        return receiptScript;
    }

    private static final class Outcome {
        final String result;
        final List<String> warnings;
        Outcome(String result, List<String> warnings) { this.result = result; this.warnings = warnings; }
    }

    private Outcome execute(String raw, long ownerPage) {
        Map<String, String> operation = NativeRecordJson.object(raw);
        String kind = NativeRecordJson.string(operation.get("op"));
        if (store == null) throw new IllegalArgumentException("文件记录实例尚未就绪");
        switch (kind) {
            case "read": {
                fields(operation, "op", "key");
                String key = NativeRecordJson.string(operation.get("key"));
                if (!current(ownerPage)) return null;
                NativeRecordStore.ReadResult result = store.read(key);
                String slot = result.rawValue == null ? "{\"found\":false}" : "{\"found\":true,\"value\":" + result.rawValue + "}";
                return new Outcome("{\"kind\":\"read\",\"revision\":" + result.revision + ",\"slot\":" + slot + "}", result.warnings);
            }
            case "scan": {
                fields(operation, "op", "prefix", "after", "limit");
                String prefix = NativeRecordJson.string(operation.get("prefix"));
                String after = "null".equals(operation.get("after")) ? null : NativeRecordJson.string(operation.get("after"));
                long limit = NativeRecordJson.generation(operation.get("limit"));
                if (limit < 1 || limit > 100) throw new IllegalArgumentException("目录页容量必须为 1～100");
                if (!current(ownerPage)) return null;
                NativeRecordStore.ScanResult result = store.scan(prefix, after, (int) limit);
                StringBuilder rows = new StringBuilder("[");
                int budget = 0;
                int count = 0;
                String next = result.next;
                String last = null;
                for (NativeRecordStore.Entry entry : result.entries) {
                    String row = "{\"key\":" + NativeRecordJson.quote(entry.key) + ",\"value\":" + entry.rawValue + "}";
                    int size = bytes(row) + 1;
                    if (count > 0 && budget + size > MAX_REQUEST) { next = last; break; }
                    if (count++ > 0) rows.append(',');
                    rows.append(row);
                    budget += size;
                    last = entry.key;
                }
                return new Outcome("{\"kind\":\"scan\",\"revision\":" + result.revision + ",\"entries\":" + rows.append(']')
                        + ",\"next\":" + (next == null ? "null" : NativeRecordJson.quote(next)) + "}", result.warnings);
            }
            case "replace": {
                fields(operation, "op", "key", "value");
                String key = NativeRecordJson.string(operation.get("key"));
                if (!current(ownerPage)) return null;
                return written(store.replaceProgress(key, operation.get("value")));
            }
            case "cas": {
                fields(operation, "op", "key", "expected", "value");
                String key = NativeRecordJson.string(operation.get("key"));
                long expected = NativeRecordJson.generation(operation.get("expected"));
                if (!current(ownerPage)) return null;
                return written(store.compareExchange(key, expected, operation.get("value")));
            }
            default: throw new IllegalArgumentException("未知原生记录操作");
        }
    }

    private static Outcome written(NativeRecordStore.WriteResult result) {
        return new Outcome("{\"kind\":\"" + (result.committed ? "committed" : "conflict") + "\",\"revision\":" + result.revision + "}", result.warnings);
    }
    private static void fields(Map<String, String> object, String... expected) {
        if (object.size() != expected.length || !object.keySet().containsAll(Arrays.asList(expected))) {
            throw new IllegalArgumentException("原生记录请求字段无效");
        }
    }
    private static int bytes(String text) { return text.getBytes(StandardCharsets.UTF_8).length; }
    private static String warnings(List<String> messages) {
        StringBuilder json = new StringBuilder("[");
        int count = Math.min(15, messages.size());
        for (int index = 0; index < count; index++) {
            if (index > 0) json.append(',');
            String message = messages.get(index);
            json.append(NativeRecordJson.quote(message.substring(0, Math.min(message.length(), 512))));
        }
        if (messages.size() > count) {
            if (count > 0) json.append(',');
            json.append(NativeRecordJson.quote("另外 " + (messages.size() - count) + " 条存储警告，当前提交结果不因此改变"));
        }
        return json.append(']').toString();
    }
    private static String failed(String owner, long id, String code, String message) {
        return "{\"format\":\"haifeng.native-record-reply/1\",\"owner\":" + NativeRecordJson.quote(owner)
                + ",\"id\":" + id + ",\"ok\":false,\"error\":{\"code\":" + NativeRecordJson.quote(code)
                + ",\"message\":" + NativeRecordJson.quote(message.substring(0, Math.min(message.length(), 1024))) + "},\"warnings\":[]}";
    }
    private static String script(String reply) {
        // Quote the complete JSON text, then JSON.parse it. Record text never becomes executable code.
        return "(() => {if(window.top!==window||location.href!=='" + START + "')return false;"
                + "const b=window.__HAIFENG_RECORDS__;return b?.protocol==='haifeng.native-records/1'"
                + "?b.receive(JSON.parse(" + NativeRecordJson.quote(reply) + ")):false;})()";
    }

    @Override public void close() {
        if (closed.getAndSet(true)) return;
        ready = false;
        page.incrementAndGet();
        observation++;
        observing = false;
        handler.removeCallbacksAndMessages(null);
        // Drain already started work, then release the lease. No interrupt or cancellation claims.
        worker.execute(() -> {
            if (store != null) {
                try { store.close(); }
                catch (NativeRecordStore.StorageError failure) { Log.w("HaifengRecords", "试用文件记录目录锁关闭未确认"); }
            }
        });
        worker.shutdown();
    }
}
