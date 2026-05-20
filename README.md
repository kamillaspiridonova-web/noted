# Noted

A private notes app with a WhatsApp/Telegram-style messenger interface, organised into notebooks with support for file attachments (images, docs, Excel, MP4, MP3).

## Download

Pre-built installers are published to [**GitHub Releases**](../../releases) automatically when a version tag is pushed.

| Platform | File | Notes |
|----------|------|-------|
| **Windows** | `Noted-Setup-*.exe` | Run the installer — no admin rights needed |
| **Android** | `app-debug.apk` | Enable *Install from unknown sources* in Settings before installing |

> Both apps connect to the live deployed server and require an internet connection.

---

## Running locally (developers)

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database
- Replit Object Storage bucket (or set env vars to local equivalents)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/noted.git
cd noted

# Install all workspace dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env

# Push the database schema
pnpm --filter @workspace/db run push

# Start the API server (port 5000) and the web frontend
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/noted run dev
```

Open the URL printed by Vite in your browser.

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket ID |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public path prefix for stored objects |
| `PRIVATE_OBJECT_DIR` | Private upload directory |
| `SESSION_SECRET` | Secret for session signing |

---

## Building the desktop / mobile apps yourself

### Windows installer

The Windows `.exe` is built by [electron-builder](https://www.electron.build/) and requires Windows (or GitHub Actions).

```bash
cd desktop
npm install
# Set APP_URL to your deployed server URL first
APP_URL=https://your-app.replit.app npm run dist
# Output: desktop/dist/Noted Setup *.exe
```

### Android APK

The Android APK is built via [Capacitor](https://capacitorjs.com/) and requires the Android SDK.

```bash
cd android-wrapper
npm install
# Set APP_URL, then add the Android platform and build
APP_URL=https://your-app.replit.app npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# Output: android-wrapper/android/app/build/outputs/apk/debug/app-debug.apk
```

### GitHub Actions (recommended)

1. Fork or push to GitHub  
2. Go to **Settings → Secrets and variables → Actions**  
3. Add a repository secret: `APP_URL` = your deployed app URL (e.g. `https://noted-abc123.replit.app`)  
4. Go to **Actions → Build Windows Installer** (or **Build Android APK**) and click **Run workflow**  
5. Download the built file from the workflow's **Artifacts** section

To create a versioned release (appears under Releases), push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Tech stack

- **Frontend** — React + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- **Backend** — Express 5, PostgreSQL + Drizzle ORM
- **Auth** — Clerk (email + password)
- **File storage** — Replit Object Storage (GCS-backed, presigned URL uploads)
- **Desktop** — Electron 31 + electron-builder (Windows NSIS installer)
- **Mobile** — Capacitor 6 (Android WebView wrapper)
- **CI/CD** — GitHub Actions

## Project structure

```
artifacts/
  api-server/   — Express API
  noted/        — React web app
lib/
  api-spec/     — OpenAPI spec + codegen
  db/           — Drizzle schema + migrations
desktop/        — Electron Windows wrapper
android-wrapper/ — Capacitor Android wrapper
.github/
  workflows/    — CI/CD for Windows + Android builds
```
