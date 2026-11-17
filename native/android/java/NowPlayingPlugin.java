package com.mengnattawit.dot;

import android.content.Intent;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for the lock-screen player (see src/lib/now-playing.ts). */
@CapacitorPlugin(name = "NowPlaying")
public class NowPlayingPlugin extends Plugin {
    private static NowPlayingPlugin instance;

    private final ScheduledExecutorService metaExec = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> metaTask;
    private volatile String lastTitle;
    private volatile int failures;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "Do.T");
        String artist = call.getString("artist", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        String artwork = call.getString("artwork", null);
        String artworkUrl = call.getString("artworkUrl", null);

        MediaPlaybackService running = MediaPlaybackService.instance;
        if (running != null) {
            // Already running: update in place (no background foreground-service start needed).
            running.applyUpdate(title, artist, playing, artwork);
            if (artworkUrl != null) running.loadArtworkUrl(artworkUrl);
        } else if (playing) {
            Intent i = new Intent(getContext(), MediaPlaybackService.class)
                .setAction(MediaPlaybackService.ACTION_UPDATE)
                .putExtra("title", title)
                .putExtra("artist", artist)
                .putExtra("playing", true)
                .putExtra("artwork", artwork)
                .putExtra("artworkUrl", artworkUrl);
            try {
                ContextCompat.startForegroundService(getContext(), i);
            } catch (IllegalStateException e) {
                call.reject("Cannot start player service: " + e.getMessage());
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        MediaPlaybackService running = MediaPlaybackService.instance;
        if (running != null) running.shutdown();
        call.resolve();
    }

    /** Poll the stream's ICY "StreamTitle" every 15 s and emit "metadata" events on change. */
    @PluginMethod
    public void watchMetadata(PluginCall call) {
        String url = call.getString("url");
        stopWatching();
        if (url == null || url.contains(".m3u8")) {
            call.resolve();
            return;
        }
        lastTitle = null;
        failures = 0;
        metaTask = metaExec.scheduleWithFixedDelay(() -> poll(url), 0, 15, TimeUnit.SECONDS);
        call.resolve();
    }

    @PluginMethod
    public void stopMetadata(PluginCall call) {
        stopWatching();
        call.resolve();
    }

    private synchronized void stopWatching() {
        if (metaTask != null) metaTask.cancel(true);
        metaTask = null;
    }

    private void poll(String url) {
        try {
            String title = IcyMetadata.fetchTitle(url);
            failures = 0;
            if (title == null || title.equals(lastTitle)) return;
            lastTitle = title;
            JSObject data = new JSObject();
            data.put("url", url);
            data.put("title", title);
            notifyListeners("metadata", data, true);
        } catch (IcyMetadata.Unsupported e) {
            stopWatching(); // this server never sends titles
        } catch (Exception e) {
            if (++failures >= 4) stopWatching();
        }
    }

    @Override
    protected void handleOnDestroy() {
        metaExec.shutdownNow();
        super.handleOnDestroy();
    }

    static void emit(String action) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        instance.notifyListeners("action", data, true);
    }
}
