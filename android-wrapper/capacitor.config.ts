import type { CapacitorConfig } from "@capacitor/cli";

// ─── Configuration ────────────────────────────────────────────────────────────
// The URL of your deployed Noted app.
// In CI this is replaced by the APP_URL GitHub secret.
const APP_URL =
  process.env.APP_URL || "https://YOUR_PUBLISHED_APP_URL.replit.app";
// ─────────────────────────────────────────────────────────────────────────────

const config: CapacitorConfig = {
  appId: "com.noted.app",
  appName: "Noted",
  webDir: "public",
  server: {
    // Load the live deployed app instead of bundled files
    url: APP_URL,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#ffffff",
  },
};

export default config;
