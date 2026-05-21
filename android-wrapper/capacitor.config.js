const APP_URL =
  process.env.APP_URL || "https://YOUR_PUBLISHED_APP_URL.replit.app";

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.noted.app",
  appName: "Noted",
  webDir: "public",
  server: {
    url: APP_URL,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#ffffff",
  },
};

module.exports = config;
