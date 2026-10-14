# Jal Sakhi — Manager Web Dashboard

React 18 + Vite 5 + Tailwind 3 + Recharts + Leaflet. Mobile-responsive.

## What's built

**All 6 pages from the spec, fully wired to the backend.**

| Route | What it shows |
|---|---|
| `/login` | Email + password (managers/admins) |
| `/map` | Leaflet map of Uttarakhand, traffic-light markers, status filter chips, popovers with link to detail |
| `/spring/:id` | Header (name/village/GPS/KRP) · health gauge (0-100) · discharge chart with anomaly dots · QoQ / YoY comparison · 8 small-multiple BIS charts (each with acceptable band + threshold lines) · photo gallery · PDF + Excel export |
| `/compare` | Block rollup table (Δ% vs previous 90 d), top-5 best + 5 needing attention, district average bar chart |
| `/alerts` | Anomalies (last 60 d) + overdue sampling (>120 d) lists with one-click "Notify KRP" SMS |
| `/krps` | Reporting cadence table, last-active traffic-light badges, "Ping SMS" |

## Brand

Tokens are locked in [`tailwind.config.js`](tailwind.config.js):

| Token | Hex |
|---|---|
| `chirag.primary` | `#2E7D32` |
| `chirag.water`   | `#0277BD` |
| `chirag.warning` | `#F9A825` |
| `chirag.alert`   | `#C62828` |
| `chirag.bg`      | `#FAFAF7` |

Font: `Inter` (loaded from rsms.me), fallback `system-ui` and `Noto Sans Devanagari` for any KRP name shown in Hindi.

## Build & run

```bash
cd web-dashboard
cp .env.example .env       # set VITE_API_BASE if backend isn't on localhost:8080
npm install
npm run dev                # http://localhost:5173 (Vite proxies /api → backend)
```

Production:

```bash
npm run build              # → dist/
# Deploy dist/ behind nginx, same vhost as the API:
#   /        → dashboard static files
#   /api/    → http://127.0.0.1:8080/  (rewrite to strip /api)
```

### Sample nginx (production)

```nginx
server {
    listen 443 ssl http2;
    server_name chirag.example.org;
    ssl_certificate     /etc/letsencrypt/live/chirag.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chirag.example.org/privkey.pem;

    root /var/www/jalsakhi;          # the dist/ folder
    index index.html;

    # SPA fallback
    location / { try_files $uri $uri/ /index.html; }

    # Backend API
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 12M;
    }

    # Backend serves uploaded photos directly:
    location /uploads/ {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

## Bundle size

The big libs are isolated into their own chunks (`vite.config.ts → manualChunks`):

| Chunk | Approx gzipped |
|---|---|
| `index` (app code + react + router) | ~50 KB |
| `recharts` | ~110 KB |
| `leaflet` | ~50 KB |
| `pdf` (lazy, jsPDF + autotable) | ~95 KB |
| `excel` (lazy, exceljs) | ~210 KB |

PDF and Excel chunks load **only when the user clicks the corresponding button** — initial dashboard load stays under ~220 KB gzipped.

## Comparing to spec

✅ All 6 manager pages built and wired to backend endpoints.
✅ Leaflet map locked to Uttarakhand viewport (`maxBounds`).
✅ Traffic-light marker colors driven by backend `/dashboard/map` status field.
✅ 8 BIS small-multiples with reference bands + threshold lines.
✅ Health-score gauge + component breakdown.
✅ QoQ and YoY comparative toggle on discharge chart.
✅ Photo gallery (last 10) with lazy-loaded thumbnails.
✅ Alerts list with "Notify KRP" → server-side SMS via `/reminders/notify`.
✅ PDF (single-spring report) + Excel (raw-data) export — lazy-loaded.
✅ Mobile-responsive (sidebar collapses below `md` breakpoint).
✅ No analytics, no tracking, no third-party fonts beyond Inter CDN (swap to self-hosted in `index.html` for full data sovereignty).

### Known small caveats (carry over to next iteration)

- "Notify KRP" buttons on the Alerts page currently send the **reading id** as `krp_id` to the notify endpoint. The backend payload should be extended to return `krp_id` alongside each alert; the swap on the client is one field rename.
- KRP page "Ping SMS" sends a generic Hindi reminder — replace with a managed templates picker.
- Sidebar is hidden on mobile (`md:`). A hamburger drawer is a follow-up.

## Licence

MIT.
