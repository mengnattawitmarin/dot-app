package com.mengnattawit.dot;

import android.content.Intent;

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

        MediaPlaybackService running = MediaPlaybackService.instance;
        if (running != null) {
            // Already running: update in place (no background foreground-service start needed).
            running.applyUpdate(title, artist, playing, artwork);
        } else if (playing) {
            Intent i = new Intent(getContext(), MediaPlaybackService.class)
                .setAction(MediaPlaybackService.ACTION_UPDATE)
                .putExtra("title", title)
                .putExtra("artist", artist)
                .putExtra("playing", true)
                .putExtra("artwork", artwork);
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

    static void emit(String action) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        instance.notifyListeners("action", data, true);
    }
}
