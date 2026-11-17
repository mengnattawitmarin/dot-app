`debug.keystore` — fixed **debug** signing key (password `android`, alias `androiddebugkey`).
CI copies it to `~/.android/debug.keystore` so every debug APK has the same signature and
installs as an update over the previous one. It is NOT for Play Store releases — use the
`ANDROID_KEYSTORE_*` secrets for that (see README).
