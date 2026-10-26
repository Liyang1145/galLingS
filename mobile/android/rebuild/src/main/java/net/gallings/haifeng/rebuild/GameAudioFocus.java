package net.gallings.haifeng.rebuild;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import java.util.function.Consumer;

/** Owns native audio permission/lifecycle only. It never reads story, media or player records. */
final class GameAudioFocus implements AutoCloseable {
    static final class State {
        final boolean interrupted;
        final String status;

        State(boolean interrupted, String status) {
            this.interrupted = interrupted;
            this.status = status;
        }
    }

    private final Context context;
    private final AudioManager manager;
    private final Handler handler;
    private final Runnable changed;
    private final Consumer<String> problem;
    private AudioFocusRequest request;
    private AudioManager.OnAudioFocusChangeListener listener;
    private boolean resumed;
    private boolean focused;
    private boolean wanted;
    private boolean held;
    private boolean focusInterrupted;
    private boolean outputInterrupted;
    private boolean registered;
    private boolean registrationWarned;
    private boolean closed;
    private long generation;
    private String status = "not-requested";
    private final BroadcastReceiver outputChanges = new BroadcastReceiver() {
        @Override public void onReceive(Context source, Intent intent) {
            if (closed || !wanted || outputInterrupted || intent == null
                    || !AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) return;
            abandon(false);
            outputInterrupted = true;
            status = "interrupted";
            changed.run();
        }
    };

    GameAudioFocus(Context context, Handler handler, Runnable changed, Consumer<String> problem) {
        this.context = context.getApplicationContext();
        this.manager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        this.handler = handler;
        this.changed = changed;
        this.problem = problem;
        registerOutputChanges();
    }

    State snapshot() {
        return new State(focusInterrupted || outputInterrupted, status);
    }

    @SuppressWarnings("deprecation")
    private boolean registerOutputChanges() {
        if (registered) return true;
        if (closed) return false;
        try {
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            if (Build.VERSION.SDK_INT >= 33) {
                context.registerReceiver(outputChanges, filter, null, handler, Context.RECEIVER_NOT_EXPORTED);
            } else context.registerReceiver(outputChanges, filter, null, handler);
            registered = true;
            registrationWarned = false;
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }

    /** Background/focus changes cannot acknowledge an output interruption on the player's behalf. */
    void setForeground(boolean resumed, boolean focused) {
        if (closed || (this.resumed == resumed && this.focused == focused)) return;
        boolean returned = !this.resumed && resumed;
        boolean gainedFocus = !this.focused && focused;
        this.resumed = resumed;
        this.focused = focused;
        if (!resumed) abandon(false);
        else if (wanted && !held && !focusInterrupted && !outputInterrupted && (returned || gainedFocus)) {
            requestFocus(false);
            return;
        }
        changed.run();
    }

    /** Explicit page request, including the visible "enable sound" action after interruption. */
    void request() {
        if (!closed) requestFocus(true);
    }

    @SuppressWarnings("deprecation")
    private void requestFocus(boolean explicit) {
        if (closed) return;
        wanted = true;
        if (outputInterrupted && (!explicit || !resumed || !focused)) {
            status = "interrupted";
            changed.run();
            return;
        }
        if (explicit) outputInterrupted = false;
        if (held) { changed.run(); return; }
        abandon(false);
        if (!resumed || !focused || manager == null || !registerOutputChanges()) {
            status = "denied";
            if (!registered && !registrationWarned) {
                registrationWarned = true;
                problem.accept("声音输出变化监听尚未就绪，暂未启用声音；可重试或静音继续。");
            }
            changed.run();
            return;
        }
        final long owner = ++generation;
        listener = change -> handler.post(() -> {
            if (closed || owner != generation || !resumed || !wanted || outputInterrupted) return;
            if (change == AudioManager.AUDIOFOCUS_GAIN) {
                held = true;
                focusInterrupted = false;
                status = "granted";
            } else if (change == AudioManager.AUDIOFOCUS_LOSS
                    || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                    || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                held = false;
                focusInterrupted = true;
                status = "interrupted";
            } else return;
            changed.run();
        });
        try {
            int result;
            if (Build.VERSION.SDK_INT >= 26) {
                request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        .setAcceptsDelayedFocusGain(false)
                        .setWillPauseWhenDucked(true)
                        .setOnAudioFocusChangeListener(listener, handler).build();
                result = manager.requestAudioFocus(request);
            } else {
                result = manager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                // WebView requests its own playback focus. Release this permission probe
                // before publishing grant so the two clients cannot interrupt each other.
                abandon(false);
                held = true;
                status = "granted";
            } else {
                abandon(false);
                status = "denied";
            }
        } catch (RuntimeException error) {
            abandon(false);
            status = "denied";
        }
        changed.run();
    }

    /** Keeps an output interruption across background; release explicitly ends that sound session. */
    @SuppressWarnings("deprecation")
    private void abandon(boolean clearWanted) {
        generation++;
        if (clearWanted) {
            wanted = false;
            outputInterrupted = false;
        }
        AudioFocusRequest previousRequest = request;
        AudioManager.OnAudioFocusChangeListener previousListener = listener;
        request = null;
        listener = null;
        held = false;
        focusInterrupted = false;
        status = outputInterrupted ? "interrupted" : "not-requested";
        if (manager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26 && previousRequest != null) manager.abandonAudioFocusRequest(previousRequest);
            else if (previousListener != null) manager.abandonAudioFocus(previousListener);
        } catch (RuntimeException error) {
            if (!closed) problem.accept("声音焦点释放尚未确认，可稍后重试启用声音。");
        }
    }

    void release() {
        if (closed) return;
        abandon(true);
        changed.run();
    }

    /** The shared mixer reports an unsolicited WebView pause, never an application pause. */
    void interrupted() {
        if (closed || !wanted) return;
        abandon(false);
        focusInterrupted = true;
        status = "interrupted";
        changed.run();
    }

    /** WebView may resume its own players after a transient focus interruption. */
    void resumedPlayback() {
        if (closed || !wanted || !resumed || !focused || outputInterrupted || !focusInterrupted) return;
        focusInterrupted = false;
        held = true;
        status = "granted";
        changed.run();
    }

    /** Page replacement clears native ownership without publishing into the document being replaced. */
    void reset() {
        if (!closed) abandon(true);
    }

    @Override public void close() {
        if (closed) return;
        closed = true;
        abandon(true);
        if (registered) {
            registered = false;
            try { context.unregisterReceiver(outputChanges); }
            catch (IllegalArgumentException ignored) { /* Already detached; closed callbacks cannot be adopted. */ }
        }
    }
}
