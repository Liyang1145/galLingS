package net.gallings.haifeng.rebuild;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.ViewGroup;
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
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Explicit integration trial. Local packaged content, no legacy bridge or interpreter fallback. */
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
    private final Handler handler = new Handler(Looper.getMainLooper());
    private AudioManager audioManager;
    private AudioFocusRequest audioRequest;
    private AudioManager.OnAudioFocusChangeListener audioListener;
    private boolean audioWanted;
    private boolean audioHeld;
    private boolean audioInterrupted;
    private long audioGeneration;
    private String audioStatus = "not-requested";
    private Runnable deliveryTimeout;
    private int deliveryAttempt;
    private boolean deliveryWarning;
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
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
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
        try {
            JSONObject manifest = new JSONObject(assetText("game/game-package.json"));
            if (!"haifeng.game-package/2".equals(manifest.getString("format"))
                    || !"haifeng.host-bridge/2".equals(manifest.getString("hostBridge"))) {
                fail("游戏包与原生宿主协议不匹配，请重新构建并准备。");
                return;
            }
            WebViewCompat.addWebMessageListener(web, "__HAIFENG_NATIVE_AUDIO__", Collections.singleton(ORIGIN),
                    (view, message, origin, mainFrame, reply) -> {
                        if (destroyed || view != web || !mainFrame || !ORIGIN.equals(origin.toString())
                                || message.getType() != WebMessageCompat.TYPE_STRING) return;
                        if ("haifeng.audio.request/1".equals(message.getData())) requestAudio();
                        else if ("haifeng.audio.release/1".equals(message.getData())) {
                            abandonAudio(true);
                            publish();
                        }
                    });
            WebViewCompat.addDocumentStartJavaScript(web, assetText("host-bootstrap.js"), Collections.singleton(ORIGIN));
        } catch (Exception error) {
            fail("宿主桥未载入：" + error.getMessage());
            return;
        }
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!isLocal(request.getUrl()) || !"GET".equals(request.getMethod())) return missing();
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
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
                page++;
                cancelDelivery();
                abandonAudio(true);
                backPending = false;
                lastBack = -1;
                if (!START.equals(url)) fail("已阻止离开本地游戏入口。");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (START.equals(url)) publish();
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
        web.loadUrl(START);
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
        boolean paused = !resumed || !focused || audioInterrupted;
        long id = ++sequence;
        String script = "(() => {const b=window.__HAIFENG_HOST__; if(b?.protocol!=='haifeng.host-bridge/2') return null;"
                + "b.receiveAudio({format:'haifeng.audio-focus/1',sequence:" + id + ",status:'" + audioStatus + "'});"
                + "b.receive({format:'haifeng.host-state/1',platform:'android-trial',sequence:"
                + id + ",paused:" + paused + "});return b.read().sequence;})()";
        deliver(web, page, id, script, 0);
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

    @SuppressWarnings("deprecation")
    private void abandonAudio(boolean clearWanted) {
        audioGeneration++;
        if (clearWanted) audioWanted = false;
        AudioFocusRequest request = audioRequest;
        AudioManager.OnAudioFocusChangeListener listener = audioListener;
        audioRequest = null;
        audioListener = null;
        audioHeld = false;
        audioInterrupted = false;
        audioStatus = "not-requested";
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= 26 && request != null) audioManager.abandonAudioFocusRequest(request);
        else if (listener != null) audioManager.abandonAudioFocus(listener);
    }

    @SuppressWarnings("deprecation")
    private void requestAudio() {
        if (destroyed || web == null) return;
        audioWanted = true;
        if (audioHeld) { publish(); return; }
        abandonAudio(false);
        if (!resumed || !focused || audioManager == null) {
            audioStatus = "denied";
            publish();
            return;
        }
        final long owner = ++audioGeneration;
        audioListener = change -> runOnUiThread(() -> {
            if (destroyed || owner != audioGeneration || !resumed || !audioWanted) return;
            if (change == AudioManager.AUDIOFOCUS_GAIN) {
                audioHeld = true;
                audioInterrupted = false;
                audioStatus = "granted";
            } else if (change == AudioManager.AUDIOFOCUS_LOSS
                    || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                    || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                audioHeld = false;
                audioInterrupted = true;
                audioStatus = "interrupted";
            } else return;
            publish();
        });
        try {
            int result;
            if (Build.VERSION.SDK_INT >= 26) {
                audioRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        .setAcceptsDelayedFocusGain(false)
                        .setWillPauseWhenDucked(true)
                        .setOnAudioFocusChangeListener(audioListener, handler).build();
                result = audioManager.requestAudioFocus(audioRequest);
            } else {
                result = audioManager.requestAudioFocus(audioListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                audioHeld = true;
                audioStatus = "granted";
            } else {
                abandonAudio(false);
                audioStatus = "denied";
            }
        } catch (RuntimeException error) {
            abandonAudio(false);
            audioStatus = "denied";
        }
        publish();
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        if (web != null) web.onResume();
        if (audioWanted) requestAudio();
        publish();
        handler.removeCallbacks(heartbeat);
        handler.postDelayed(heartbeat, 1000);
    }

    @Override protected void onPause() {
        resumed = false;
        handler.removeCallbacks(heartbeat);
        abandonAudio(false);
        publish();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        focused = hasFocus;
        if (hasFocus && resumed && audioWanted && !audioHeld
                && !"interrupted".equals(audioStatus)) requestAudio();
        publish();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (web == null) { finish(); return; }
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
            if (lastBack >= 0 && now - lastBack < 1800) finish();
            else {
                lastBack = now;
                Toast.makeText(this, "再按一次返回键退出；进度请先手动保存", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void fail(String message) {
        WebView failed = web;
        web = null;
        handler.removeCallbacks(heartbeat);
        cancelDelivery();
        abandonAudio(true);
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
        handler.removeCallbacksAndMessages(null);
        abandonAudio(true);
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
