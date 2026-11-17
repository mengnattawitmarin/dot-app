package com.mengnattawit.dot;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Foreground media service: lock-screen / notification player for Do.T.
 * Playback itself stays in the WebView; this service mirrors "now playing"
 * and forwards button presses back to JavaScript through NowPlayingPlugin.
 * Running in the foreground also keeps audio alive while the screen is locked.
 */
public class MediaPlaybackService extends Service {
    static final String ACTION_UPDATE = "com.mengnattawit.dot.UPDATE";
    static final String ACTION_TOGGLE = "com.mengnattawit.dot.TOGGLE";
    static final String ACTION_NEXT = "com.mengnattawit.dot.NEXT";
    static final String ACTION_PREV = "com.mengnattawit.dot.PREV";
    static final String ACTION_STOP = "com.mengnattawit.dot.STOP";

    private static final String CHANNEL = "dot_playback";
    private static final int NOTIFICATION_ID = 4711;

    static MediaPlaybackService instance;

    private MediaSessionCompat session;
    private String title = "Do.T";
    private String artist = "";
    private boolean playing = false;
    private Bitmap artwork;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "กำลังเล่น", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        session = new MediaSessionCompat(this, "DoT");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { NowPlayingPlugin.emit("play"); }
            @Override public void onPause() { NowPlayingPlugin.emit("pause"); }
            @Override public void onStop() { NowPlayingPlugin.emit("pause"); }
            @Override public void onSkipToNext() { NowPlayingPlugin.emit("next"); }
            @Override public void onSkipToPrevious() { NowPlayingPlugin.emit("prev"); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE.equals(action)) {
            applyUpdate(
                intent.getStringExtra("title"),
                intent.getStringExtra("artist"),
                intent.getBooleanExtra("playing", false),
                intent.getStringExtra("artwork"));
        } else if (ACTION_TOGGLE.equals(action)) {
            NowPlayingPlugin.emit(playing ? "pause" : "play");
        } else if (ACTION_NEXT.equals(action)) {
            NowPlayingPlugin.emit("next");
        } else if (ACTION_PREV.equals(action)) {
            NowPlayingPlugin.emit("prev");
        } else if (ACTION_STOP.equals(action)) {
            NowPlayingPlugin.emit("pause");
            shutdown();
        } else {
            showNotification();
        }
        return START_NOT_STICKY;
    }

    /** Called from the plugin (directly when running, or via onStartCommand on first start). */
    void applyUpdate(@Nullable String newTitle, @Nullable String newArtist, boolean isPlaying, @Nullable String artworkBase64) {
        if (newTitle != null) title = newTitle;
        if (newArtist != null) artist = newArtist;
        playing = isPlaying;
        if (artworkBase64 != null && !artworkBase64.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(artworkBase64, Base64.DEFAULT);
                artwork = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            } catch (IllegalArgumentException ignored) {
                // keep previous artwork
            }
        }
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Do.T")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1);
        if (artwork != null) {
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork);
        }
        session.setMetadata(meta.build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build());
        showNotification();
    }

    private PendingIntent serviceIntent(String action, int code) {
        Intent i = new Intent(this, MediaPlaybackService.class).setAction(action);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void showNotification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent open = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_dot)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("Do.T")
            .setContentIntent(open)
            .setDeleteIntent(serviceIntent(ACTION_STOP, 5))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(0xFFD6A856)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(playing)
            .addAction(android.R.drawable.ic_media_previous, "ก่อนหน้า", serviceIntent(ACTION_PREV, 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "หยุด" : "เล่น", serviceIntent(ACTION_TOGGLE, 2))
            .addAction(android.R.drawable.ic_media_next, "ถัดไป", serviceIntent(ACTION_NEXT, 3))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        if (artwork != null) b.setLargeIcon(artwork);

        Notification n = b.build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        // Stay in the foreground while paused too: re-entering the foreground later from the
        // lock screen (app in background) is restricted on Android 12+.
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);
        } catch (RuntimeException e) {
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
        }
    }

    void shutdown() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        shutdown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        session.setActive(false);
        session.release();
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
