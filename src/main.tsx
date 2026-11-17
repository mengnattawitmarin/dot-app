import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/components/app";
import { setupNative } from "@/lib/native";
import { setupMediaSession } from "@/lib/media-session";
import { setupNowPlaying } from "@/lib/now-playing";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void setupNative();
setupMediaSession();
setupNowPlaying();
