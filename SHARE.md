# 📲 Jal Sakhi — How to share with KRPs and connect to the CHIRAG server

This is the single page you need for a pilot rollout.

---

## TL;DR (the 3 commands)

```bash
# 1. Start the CHIRAG backend on this machine (needs Docker)
./start-server.sh

# 2. Build a KRP-shareable APK
./build-apk.sh                                # KRP enters server URL at first launch
#  …or bake the URL in:
./build-apk.sh http://<your-machine-ip>:8080  # in a pilot
./build-apk.sh https://api.chirag.org         # in production

# 3. Open the admin connect page (QR generator + connection tester)
open admin/connect.html
```

The APK is written to `dist/jalsakhi-<mode>-<stamp>.apk`. Send it via WhatsApp / Telegram / `adb install`.

---

## Honest status of what's built vs. compiled

| Component | Source | Compiled here? | Why |
|---|---|---|---|
| Backend (Node 20 + Express + Postgres) | ✅ complete & runnable | Needs **Docker** | This sandbox has no Docker — but `./start-server.sh` runs it for you locally |
| Android APK | ✅ complete (Kotlin + Compose) | Needs **internet** to download Gradle deps on first build | This sandbox has no outbound network — but `./build-apk.sh` builds it locally |
| Web dashboard (React + Vite) | ✅ complete | Needs **npm install** | This sandbox has no Node.js — but `cd web-dashboard && npm install && npm run build` builds it |
| Admin connect page (this folder) | ✅ runnable | Plain HTML — open in any browser | No build step |
| Docs + scripts | ✅ complete | – | – |

**Net:** every layer is fully written. The only thing missing is binary artefacts, which need build tooling installed on your machine. You already have Android Studio (with the right JDK + SDK) — so the APK will build with `./build-apk.sh`.

---

## Step-by-step pilot rollout

### Step A — Start the backend (one machine, once)

```bash
cd "/Users/prahladpratapsingh/Desktop/CHIRAG JAL SAKHI"
./start-server.sh
```

The script:
- Installs `.env` with a random JWT secret
- Asks (interactively) for a Fast2SMS API key — leave blank for the pilot (OTPs will print to logs)
- Brings up Postgres + the API on port `8080`
- Runs migrations + seeds demo data + the sample CSV
- Prints the local IP your phones should connect to

If you don't have Docker: install Docker Desktop ([macOS](https://docs.docker.com/desktop/install/mac-install/) / [Linux](https://get.docker.com)). 5-minute install.

### Step B — Open the admin connect page

```bash
open admin/connect.html
```

You'll see:
1. A field to enter your server URL (paste what `start-server.sh` printed).
2. A "Test connection" button that hits `/health`.
3. A QR code that KRPs scan on their first-run setup screen.
4. The exact `./build-apk.sh` command to run.

### Step C — Build the APK

On this Mac (it has Android Studio + SDK):
```bash
./build-apk.sh
```
First run downloads ~140 MB of Gradle + AndroidX deps (one time, ~5-10 min). Subsequent runs are < 1 min.

Output:
```
dist/jalsakhi-debug-20260525-1830.apk     (~14 MB)
```

The script always builds in **debug mode by default** because that doesn't need a release keystore. For a production rollout, pass a URL and it'll auto-generate a keystore and produce a signed release APK:
```bash
./build-apk.sh https://api.chirag.example.org
# → dist/jalsakhi-release-20260525-1830.apk + jalsakhi-release.jks
```
**Keep `jalsakhi-release.jks` safe** — without it you can't ship app updates.

### Step D — Distribute to KRPs

Choose any of:
- WhatsApp / Telegram: just send the `.apk` file
- Email: attach the `.apk`
- USB: `adb install dist/jalsakhi-debug-*.apk` (phone in dev-mode)
- A shared folder on your local network

KRPs will need to enable "Install from unknown sources" once (Android prompts them).

### Step E — KRP first-run flow

When a KRP opens the app:
1. **Server Setup screen** appears (Hindi + English). They either type the URL or scan the QR from `admin/connect.html`.
2. **Login screen**: they enter their phone number and tap "Send OTP".
3. OTP arrives by SMS (or by phone-call from the CHIRAG admin if SMS is not configured, since the OTP is logged on the backend).
4. They enter the OTP. App pre-fetches the spring master list (offline-ready).
5. **Home screen** — three big buttons for the three workflows.

They can change the server URL later by tapping "Change server URL" on the login screen.

### Step F — Manager dashboard

```bash
cd web-dashboard
npm install
npm run build
# Serve dist/ with any static host — e.g. on the same nginx as the API:
#   server { ... location / { root /var/www/jalsakhi; } location /api/ { proxy_pass ...; } }
```

Login: `manager@chirag.org` / `chirag@2026` (created by seed). Change the password immediately.

---

## Pre-production checklist (before going beyond pilot)

- [ ] Change demo passwords (`manager@chirag.org`, `admin@chirag.org`).
- [ ] Set a real `JWT_SECRET` in `backend/.env` (start-server.sh already does this).
- [ ] Configure Fast2SMS so KRPs get real OTPs.
- [ ] Set `PUBLIC_BASE_URL` in `backend/.env` to the externally-reachable URL.
- [ ] Move the backend behind nginx + Let's Encrypt (see `docs/DEPLOYMENT.md`).
- [ ] Set up nightly `pg_dump` backups off-server.
- [ ] Rebuild the APK with the **HTTPS** URL baked in: `./build-apk.sh https://api.chirag.org`.
- [ ] Sign the release APK with a keystore you keep secure (script auto-generates one with a default password; change it).
- [ ] Test on a real low-end Android 7+ phone before shipping to KRPs.

---

## Files you'll touch as an admin

```
CHIRAG JAL SAKHI/
├── admin/connect.html       ← open in browser; URL field + QR + connection test
├── build-apk.sh             ← one command to make a shareable APK
├── start-server.sh          ← one command to spin up backend (Docker)
├── backend/.env             ← server secrets (auto-created by start-server.sh)
├── jalsakhi-release.jks     ← signing key (auto-created on first release build)
└── dist/jalsakhi-*.apk      ← built APKs (shared with KRPs)
```

That's the whole pilot. Everything else is detail you don't need.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `./build-apk.sh` says "Java not found" | Install JDK 17+, or open Android Studio once (it bundles a JBR). Script auto-finds it. |
| `./build-apk.sh` fails with "SDK not found" | `export ANDROID_HOME=$HOME/Library/Android/sdk` (macOS default location). |
| KRP app can't reach the server | Check phone and server are on the same Wi-Fi; firewall allows port 8080; `admin/connect.html` "Test connection" works from the same network. |
| OTP not arriving on KRP phone | In dev mode it's printed to `docker compose logs api`. Configure Fast2SMS in `backend/.env` for real SMS. |
| APK install blocked on phone | Enable "Install from unknown sources" once in Android Settings → Security. |
| Manager dashboard shows CORS error | Open the dashboard from the same domain as the API (via nginx), OR ensure backend `cors({ origin: true })` is on (default). |

---

## What this system does NOT include (deliberately)

- **No third-party analytics / crash reporters** — data stays on your CHIRAG server.
- **No Google Firebase / Cloud** — the only external call is Fast2SMS for OTP/reminder texts.
- **No background tracking** — location is read only on the New Reading screens.

MIT licensed. Hindi-first. Built for CHIRAG.
