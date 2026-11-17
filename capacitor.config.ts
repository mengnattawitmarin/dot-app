import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mengnattawit.dot",
  appName: "Do.T",
  webDir: "dist",
  backgroundColor: "#0b0a08",
  android: {
    // Some Thai radio streams are served over plain HTTP.
    allowMixedContent: true,
  },
  ios: {
    contentInset: "never",
    // Inline <video> + audio keeps playing when the screen locks (needs UIBackgroundModes=audio, see scripts/patch-native.mjs).
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b0a08",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0a08",
      overlaysWebView: true,
    },
  },
};

export default config;
