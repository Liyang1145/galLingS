package net.gallings.haifeng.rebuild;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local packaged game, no legacy bridge or interpreter fallback. */
public final class RebuildActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/game/index.html";
    private static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; "
            + "object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
    private WebView web;
    private boolean resumed;
    private boolean focused;
    private boolean destroyed;
    private boolean backPending;
    private long sequence;
    private long page;
    private long lastBack = -1;
    private long exitSequence;
    private long activeExit;
    private Runnable exitPoll;
    private long exitStarted;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private GameAudioFocus audioFocus;
    private NativeRecordBridge records;
    private Runnable deliveryTimeout;
    private int deliveryAttempt;
    private boolean deliveryWarning;
    private boolean fullscreen;
    private long displaySequence;
    private long displayRequest;
    private String displayIssue;
    private String displayOwner;
    private boolean displayReady;
    private int previousUi;
    private boolean previousFullscreenFlag;
    private int previousHiddenBars;
    private int previousBarsBehavior;
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (destroyed || !resumed || web == null) return;
            publish();
            handler.postDelayed(this, 1000);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        audioFocus = new GameAudioFocus(this, handler, this::publish,
                message -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient());
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            fail("当前系统 WebView 不支持启动前宿主接线；请更新 WebView 后重试。没有切换旧播放器。");
            return;
        }
        final PackagedMedia media;
        try {
            JSONObject manifest = new JSONObject(assetText("game/game-package.json"));
            if (!"haifeng.game-package/2".equals(manifest.getString("format"))
                    || !"haifeng.host-bridge/3".equals(manifest.getString("hostBridge"))
                    || !"game".equals(manifest.getString("purpose"))) {
                fail("游戏包与原生宿主协议不匹配，请重新构建并准备。");
                return;
            }
            String workId = manifest.getString("workId");
            media = new PackagedMedia(getAssets(), manifest.getJSONArray("resources"));
            checkRecordClient(manifest);
            String recordScript = replaceMarker(assetText("native-records-bootstrap.js"),
                    "__HAIFENG_FILE_RECORDS__", "true");
            recordScript = replaceMarker(recordScript, "__HAIFENG_RECORD_WORK__", NativeRecordJson.quote(workId));
            WebViewCompat.addWebMessageListener(web, "__HAIFENG_NATIVE_AUDIO__", Collections.singleton(ORIGIN),
                    (view, message, origin, mainFrame, reply) -> {
                        if (destroyed || view != web || !mainFrame || !ORIGIN.equals(origin.toString())
                                || message.getType() != WebMessageCompat.TYPE_STRING) return;
                        if ("haifeng.audio.request/1".equals(message.getData())) audioFocus.request();
                        else if ("haifeng.audio.interrupted/1".equals(message.getData())) audioFocus.interrupted();
                        else if ("haifeng.audio.resumed/1".equals(message.getData())) audioFocus.resumedPlayback();
                        else if ("haifeng.audio.release/1".equals(message.getData())) {
                            audioFocus.release();
                        }
                    });
            WebViewCompat.addWebMessageListener(web, "__HAIFENG_NATIVE_DISPLAY__", Collections.singleton(ORIGIN),
                    (view, message, origin, mainFrame, reply) -> {
                        if (destroyed || view != web || !mainFrame || !ORIGIN.equals(origin.toString())
                                || message.getType() != WebMessageCompat.TYPE_STRING) return;
                        try {
                            String text = message.getData();
                            if (text == null || text.length() > 256) throw new IllegalArgumentException("全屏请求过长");
                            JSONObject request = new JSONObject(text);
                            Object id = request.get("id");
                            if (request.length() != 4 || !"haifeng.fullscreen-request/1".equals(request.getString("format"))
                                    || !(request.get("active") instanceof Boolean)
                                    || !(request.get("owner") instanceof String)
                                    || !request.getString("owner").matches("[a-f0-9-]{36}")
                                    || (!(id instanceof Integer) && !(id instanceof Long))
                                    || request.getLong("id") < 1 || request.getLong("id") > 9007199254740991L) {
                                throw new IllegalArgumentException("全屏请求字段无效");
                            }
                            if (!displayReady || displayOwner == null || !displayOwner.equals(request.getString("owner"))) return;
                            long next = request.getLong("id");
                            if (next <= displayRequest) return;
                            displayRequest = next;
                            displayIssue = null;
                            try {
                                if (!resumed || !focused || activeExit != 0) throw new IllegalStateException("请在前台且未退出时切换全屏");
                                setFullscreen(request.getBoolean("active"));
                            } catch (RuntimeException error) {
                                displayIssue = "系统栏切换未完成，请重试。";
                            }
                            publishFullscreen();
                        } catch (Exception error) {
                            Toast.makeText(this, "全屏请求格式无效，窗口保持原模式", Toast.LENGTH_SHORT).show();
                        }
                    });
            WebViewCompat.addDocumentStartJavaScript(web, recordScript + "\n" + assetText("host-bootstrap.js"), Collections.singleton(ORIGIN));
            records = new NativeRecordBridge(web, new File(getFilesDir(), "records"), workId);
        } catch (Exception error) {
            fail("游戏包或宿主桥未载入：" + error.getMessage());
            return;
        }
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!isLocal(request.getUrl())) return missing();
                String path = request.getUrl().getPath().substring("/assets/game/".length());
                WebResourceResponse response;
                if (path.startsWith("media/")) response = media.serve(request, path);
                else if ("GET".equals(request.getMethod())) response = loader.shouldInterceptRequest(request.getUrl());
                else return missing();
                if (response == null) return missing();
                Map<String, String> headers = new HashMap<>();
                if (response.getResponseHeaders() != null) headers.putAll(response.getResponseHeaders());
                headers.put("Cache-Control", "no-store");
                headers.put("X-Content-Type-Options", "nosniff");
                if ("text/html".equals(response.getMimeType())) headers.put("Content-Security-Policy", CSP);
                response.setResponseHeaders(headers);
                return response;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.isForMainFrame() || !START.equals(request.getUrl().toString());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (destroyed || view != web) return;
                if (records != null) records.pageStarted();
                page++;
                resetFullscreen();
                displayRequest = 0;
                displayOwner = null;
                displayReady = false;
                cancelExit();
                cancelDelivery();
                audioFocus.reset();
                backPending = false;
                lastBack = -1;
                if (!START.equals(url)) fail("已阻止离开本地游戏入口。");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!destroyed && view == web && START.equals(url)) {
                    displayReady = true;
                    if (records != null) records.pageFinished();
                    publish();
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) fail("本地游戏页无法读取：" + error.getDescription());
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) fail("本地游戏入口读取失败：" + response.getStatusCode());
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                fail("系统 WebView 进程已退出。请重开应用并读取已有手动存档；当前未保存位置没有自动恢复保证。");
                return true;
            }
        });
        setContentView(web);
        // WebView history is not a story checkpoint. Recreate at title and let the player load progress.
        if (records == null) fail("本地记录未准备完成，尚未开始游玩。");
        else {
            NativeRecordBridge selected = records;
            selected.start(() -> {
                if (!destroyed && web != null && records == selected) web.loadUrl(START);
            }, message -> fail("本地记录未启动：" + message));
        }
    }

    private static String replaceMarker(String source, String marker, String value) {
        int first = source.indexOf(marker);
        if (first < 0 || source.indexOf(marker, first + marker.length()) >= 0) {
            throw new IllegalArgumentException("记录桥装配标记无效，请重新准备");
        }
        return source.substring(0, first) + value + source.substring(first + marker.length());
    }

    private void checkRecordClient(JSONObject manifest) throws Exception {
        String source = assetText("game/assets/native-record-client.json");
        byte[] bytes = source.getBytes(StandardCharsets.UTF_8);
        Map<String, String> client = NativeRecordJson.object(source);
        if (client.size() != 2 || !client.containsKey("format") || !client.containsKey("protocol")
                || !"haifeng.native-record-client/1".equals(NativeRecordJson.string(client.get("format")))
                || !"haifeng.native-records/1".equals(NativeRecordJson.string(client.get("protocol")))) {
            throw new IllegalArgumentException("游戏包没有兼容的原生记录客户端，请重新构建并准备");
        }
        StringBuilder digest = new StringBuilder();
        for (byte part : MessageDigest.getInstance("SHA-256").digest(bytes)) {
            digest.append("0123456789abcdef".charAt((part & 255) >> 4)).append("0123456789abcdef".charAt(part & 15));
        }
        int registered = 0;
        JSONArray frontend = manifest.getJSONArray("frontend");
        for (int index = 0; index < frontend.length(); index++) {
            JSONObject file = frontend.getJSONObject(index);
            if (!"assets/native-record-client.json".equals(file.getString("path"))) continue;
            registered++;
            if (file.getLong("bytes") != bytes.length || !digest.toString().equals(file.getString("sha256"))) {
                throw new IllegalArgumentException("原生记录客户端与随包字节登记不一致，请重新准备");
            }
        }
        if (registered != 1) throw new IllegalArgumentException("当前游戏清单未唯一登记原生记录客户端");
    }

    private String assetText(String path) throws java.io.IOException {
        StringBuilder text = new StringBuilder();
        try (InputStreamReader reader = new InputStreamReader(getAssets().open(path), StandardCharsets.UTF_8)) {
            char[] buffer = new char[4096];
            int length;
            while ((length = reader.read(buffer)) != -1) text.append(buffer, 0, length);
        }
        return text.toString();
    }

    private static boolean isLocal(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
                && path != null && path.startsWith("/assets/game/") && !path.contains("\\")
                && !path.contains("/../") && !path.contains("/./") && path.indexOf('\0') < 0;
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
    }

    private void publish() {
        if (web == null || destroyed) return;
        publishFullscreen();
        GameAudioFocus.State audio = audioFocus.snapshot();
        boolean paused = !resumed || !focused || audio.interrupted;
        long id = ++sequence;
        String script = "(() => {const b=window.__HAIFENG_HOST__; if(b?.protocol!=='haifeng.host-bridge/3') return null;"
                + "b.receiveAudio({format:'haifeng.audio-focus/1',sequence:" + id + ",status:'" + audio.status + "'});"
                + "b.receive({format:'haifeng.host-state/1',platform:'android-trial',sequence:"
                + id + ",paused:" + paused + "});return b.read().sequence;})()";
        deliver(web, page, id, script, 0);
    }

    /** Native immersive mode, independent of HTML video/custom views and story state. */
    @SuppressWarnings("deprecation")
    private void setFullscreen(boolean active) {
        if (active == fullscreen) return;
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            WindowInsets insets = decor.getRootWindowInsets();
            if (controller == null || insets == null) throw new IllegalStateException("窗口尚未就绪");
            int bars = WindowInsets.Type.systemBars();
            if (active) {
                previousHiddenBars = 0;
                if (!insets.isVisible(WindowInsets.Type.statusBars())) previousHiddenBars |= WindowInsets.Type.statusBars();
                if (!insets.isVisible(WindowInsets.Type.navigationBars())) previousHiddenBars |= WindowInsets.Type.navigationBars();
                if (!insets.isVisible(WindowInsets.Type.captionBar())) previousHiddenBars |= WindowInsets.Type.captionBar();
                previousBarsBehavior = controller.getSystemBarsBehavior();
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(bars);
            } else {
                controller.setSystemBarsBehavior(previousBarsBehavior);
                if (previousHiddenBars != 0) controller.hide(previousHiddenBars);
                if ((bars & ~previousHiddenBars) != 0) controller.show(bars & ~previousHiddenBars);
            }
        } else {
            int mask = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            if (active) {
                previousUi = decor.getSystemUiVisibility() & mask;
                previousFullscreenFlag = (getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0;
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                decor.setSystemUiVisibility(decor.getSystemUiVisibility() | mask);
            } else {
                if (!previousFullscreenFlag) getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                decor.setSystemUiVisibility((decor.getSystemUiVisibility() & ~mask) | previousUi);
            }
        }
        fullscreen = active;
    }

    private void resetFullscreen() {
        try { setFullscreen(false); displayIssue = null; }
        catch (RuntimeException error) { displayIssue = "系统栏尚未恢复，请返回应用后重试。"; }
    }

    private void publishFullscreen() {
        if (web == null || destroyed || !displayReady) return;
        final WebView owner = web;
        final long ownerPage = page;
        try {
            owner.evaluateJavascript("(() => {const f=window.__HAIFENG_HOST__?.fullscreen;"
                    + "return f?.protocol==='haifeng.fullscreen/1'?f.identity:null;})()", answer -> {
                if (destroyed || owner != web || ownerPage != page) return;
                try {
                    Object token = new org.json.JSONTokener(answer).nextValue();
                    if (!(token instanceof String) || !((String) token).matches("[a-f0-9-]{36}")) return;
                    if (displayOwner != null && !displayOwner.equals(token)) return;
                    displayOwner = (String) token;
                    JSONObject state = new JSONObject();
                    state.put("format", "haifeng.fullscreen-state/1");
                    state.put("sequence", ++displaySequence);
                    // Reports the accepted immersive mode; temporary bars do not leave that mode.
                    state.put("active", fullscreen);
                    state.put("requestId", displayRequest == 0 ? JSONObject.NULL : displayRequest);
                    state.put("requestOwner", displayRequest == 0 ? JSONObject.NULL : displayOwner);
                    state.put("issue", displayIssue == null ? JSONObject.NULL : displayIssue);
                    owner.evaluateJavascript("(() => {const f=window.__HAIFENG_HOST__?.fullscreen;"
                            + "if(f?.protocol==='haifeng.fullscreen/1')f.receive(" + state + ");})()", null);
                } catch (Exception error) {
                    // A stale/unavailable page is retried by the existing display heartbeat.
                }
            });
        } catch (Exception error) {
            // The existing heartbeat retries display status; failure never alters story lifecycle.
        }
    }

    private void cancelDelivery() {
        if (deliveryTimeout != null) handler.removeCallbacks(deliveryTimeout);
        deliveryTimeout = null;
    }

    private void deliver(WebView owner, long ownerPage, long id, String script, int attempt) {
        if (destroyed || owner != web || ownerPage != page || id != sequence) return;
        cancelDelivery();
        deliveryAttempt = attempt;
        Runnable timeout = () -> {
            if (destroyed || owner != web || ownerPage != page || id != sequence || deliveryAttempt != attempt) return;
            deliveryTimeout = null;
            if (attempt < 2) deliver(owner, ownerPage, id, script, attempt + 1);
            else if (!deliveryWarning) {
                deliveryWarning = true;
                Toast.makeText(this, "游戏页未确认宿主状态，正在等待重新同步", Toast.LENGTH_SHORT).show();
            }
        };
        deliveryTimeout = timeout;
        handler.postDelayed(timeout, 250);
        try {
            owner.evaluateJavascript(script, result -> {
                if (destroyed || owner != web || ownerPage != page || id != sequence || deliveryAttempt != attempt) return;
                try {
                    if (Long.parseLong(result) == id) {
                        handler.removeCallbacks(timeout);
                        if (deliveryTimeout == timeout) deliveryTimeout = null;
                        deliveryWarning = false;
                    }
                } catch (NumberFormatException ignored) {
                    // A missing/invalid acknowledgement follows the same bounded timeout retry.
                }
            });
        } catch (RuntimeException error) {
            // The scheduled retry handles a transient WebView delivery failure without changing story.
        }
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        if (web != null) web.onResume();
        audioFocus.setForeground(resumed, focused);
        publish();
        handler.removeCallbacks(heartbeat);
        handler.postDelayed(heartbeat, 1000);
    }

    @Override protected void onPause() {
        resumed = false;
        handler.removeCallbacks(heartbeat);
        audioFocus.setForeground(resumed, focused);
        publish();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        focused = hasFocus;
        if (audioFocus != null) audioFocus.setForeground(resumed, focused);
        publish();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (web == null) { finish(); return; }
        if (activeExit != 0) { cancelExit(); return; }
        if (backPending) return;
        backPending = true;
        final long ownerPage = page;
        web.evaluateJavascript("window.__HAIFENG_HOST__ ? window.__HAIFENG_HOST__.back() : null", result -> {
            if (destroyed || ownerPage != page || web == null) return;
            backPending = false;
            if ("true".equals(result)) { lastBack = -1; return; }
            if (!"false".equals(result)) {
                Toast.makeText(this, "页面返回键尚未就绪，请稍后重试", Toast.LENGTH_SHORT).show();
                return;
            }
            long now = SystemClock.elapsedRealtime();
            if (lastBack >= 0 && now - lastBack < 1800) requestExit();
            else {
                lastBack = now;
                Toast.makeText(this, "再按一次返回键退出；进度请先手动保存", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void requestExit() {
        if (destroyed || web == null || activeExit != 0) return;
        activeExit = ++exitSequence;
        exitStarted = SystemClock.elapsedRealtime();
        pollExit(web, page, activeExit);
    }

    private void pollExit(WebView owner, long ownerPage, long id) {
        if (destroyed || owner != web || ownerPage != page || activeExit != id) return;
        if (SystemClock.elapsedRealtime() - exitStarted >= 30000) {
            cancelExit();
            Toast.makeText(this, "退出等待超时，保留应用；已发起的写入可能仍在进行", Toast.LENGTH_LONG).show();
            return;
        }
        final Runnable next = () -> pollExit(owner, ownerPage, id);
        exitPoll = next;
        // Schedule before evaluateJavascript so an absent callback also has a bounded retry.
        handler.postDelayed(next, 250);
        try {
            owner.evaluateJavascript("(() => {const b=window.__HAIFENG_HOST__;return b?.protocol==='haifeng.host-bridge/3'"
                    + "?b.beginExit(" + id + "):null;})()", result -> {
                if (destroyed || owner != web || ownerPage != page || activeExit != id || exitPoll != next) return;
                try {
                    JSONObject reply = new JSONObject(result);
                    if (reply.length() != 2 || reply.getLong("id") != id) throw new IllegalArgumentException("退出标识无效");
                    String status = reply.getString("status");
                    if ("pending".equals(status)) return;
                    handler.removeCallbacks(next);
                    exitPoll = null;
                    if ("ready".equals(status)) {
                        activeExit = 0;
                        finish();
                    } else {
                        cancelExit();
                        if (!"cancelled".equals(status)) Toast.makeText(this, "页面未同意退出，应用已保留", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception error) {
                    cancelExit();
                    Toast.makeText(this, "退出返回无效，应用已保留", Toast.LENGTH_SHORT).show();
                }
            });
        } catch (RuntimeException error) {
            cancelExit();
            Toast.makeText(this, "退出请求未送达，应用已保留", Toast.LENGTH_SHORT).show();
        }
    }

    private void cancelExit() {
        if (exitPoll != null) handler.removeCallbacks(exitPoll);
        exitPoll = null;
        long id = activeExit;
        activeExit = 0;
        if (id != 0 && web != null && !destroyed) {
            web.evaluateJavascript("window.__HAIFENG_HOST__?.cancelExit(" + id + ")", null);
        }
    }

    private void fail(String message) {
        WebView failed = web;
        resetFullscreen();
        cancelExit();
        if (records != null) { records.close(); records = null; }
        web = null;
        handler.removeCallbacks(heartbeat);
        cancelDelivery();
        audioFocus.close();
        page++;
        backPending = false;
        if (failed != null) {
            failed.stopLoading();
            if (failed.getParent() instanceof ViewGroup) ((ViewGroup) failed.getParent()).removeView(failed);
            failed.destroy();
        }
        TextView error = new TextView(this);
        error.setText("海风与布丁 · Android 重构集成试用\n\n" + message);
        error.setTextColor(Color.WHITE);
        error.setBackgroundColor(Color.BLACK);
        error.setPadding(24, 24, 24, 24);
        setContentView(error);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        activeExit = 0;
        handler.removeCallbacksAndMessages(null);
        if (records != null) { records.close(); records = null; }
        if (audioFocus != null) audioFocus.close();
        page++;
        if (web != null) {
            WebView old = web;
            web = null;
            old.stopLoading();
            if (old.getParent() instanceof ViewGroup) ((ViewGroup) old.getParent()).removeView(old);
            old.destroy();
        }
        super.onDestroy();
    }
}
