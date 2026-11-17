// Run after `cap add ios` / `cap add android` (and safe to re-run).
// - iOS: keep radio playing with the screen locked (UIBackgroundModes = audio), allow inline video.
// - Android: allow cleartext HTTP streams used by a few Thai stations, and install the
//   lock-screen player (native/android → MediaPlaybackService + NowPlaying plugin).
import fs from "node:fs";
import path from "node:path";

function patch(file, fn) {
  if (!fs.existsSync(file)) return console.log(`skip ${file} (platform not added)`);
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`patched ${file}`);
  } else console.log(`ok ${file}`);
}

patch("ios/App/App/Info.plist", (s) => {
  if (s.includes("UIBackgroundModes")) return s;
  return s.replace(
    /<dict>/,
    `<dict>
\t<key>UIBackgroundModes</key>
\t<array>
\t\t<string>audio</string>
\t</array>
\t<key>NSAppTransportSecurity</key>
\t<dict>
\t\t<key>NSAllowsArbitraryLoadsForMedia</key>
\t\t<true/>
\t</dict>`,
  );
});

patch("android/app/src/main/AndroidManifest.xml", (s) => {
  if (!s.includes("usesCleartextTraffic")) {
    s = s.replace("<application", '<application\n        android:usesCleartextTraffic="true"');
  }
  for (const perm of ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_MEDIA_PLAYBACK", "WAKE_LOCK", "POST_NOTIFICATIONS"]) {
    const line = `<uses-permission android:name="android.permission.${perm}" />`;
    if (!s.includes(`android.permission.${perm}"`)) s = s.replace("</manifest>", `    ${line}\n</manifest>`);
  }
  if (!s.includes(".MediaPlaybackService")) {
    s = s.replace(
      "</application>",
      `    <service
            android:name=".MediaPlaybackService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
    </application>`,
    );
  }
  return s;
});

patch("android/app/build.gradle", (s) => {
  if (s.includes("androidx.media:media")) return s;
  return s.replace(/dependencies\s*\{/, (m) => `${m}\n    implementation "androidx.media:media:1.7.0"`);
});

// Copy native sources (overwrites the generated MainActivity so it registers the plugin).
const javaDir = "android/app/src/main/java/com/mengnattawit/dot";
if (fs.existsSync("android/app/src/main")) {
  fs.mkdirSync(javaDir, { recursive: true });
  for (const f of fs.readdirSync("native/android/java")) {
    fs.copyFileSync(path.join("native/android/java", f), path.join(javaDir, f));
    console.log(`copied ${f}`);
  }
  const resSrc = "native/android/res";
  for (const dir of fs.readdirSync(resSrc)) {
    const dest = path.join("android/app/src/main/res", dir);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(path.join(resSrc, dir))) fs.copyFileSync(path.join(resSrc, dir, f), path.join(dest, f));
  }
}
