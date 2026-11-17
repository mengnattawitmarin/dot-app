// Run after `cap add ios` / `cap add android` (and safe to re-run).
// - iOS: keep radio playing with the screen locked (UIBackgroundModes = audio), allow inline video.
// - Android: allow cleartext HTTP streams used by a few Thai stations, keep screen orientation free.
import fs from "node:fs";

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
  if (s.includes("usesCleartextTraffic")) return s;
  return s.replace("<application", '<application\n        android:usesCleartextTraffic="true"');
});
