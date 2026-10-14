# Jal Sakhi (जल सखी) - Spring Monitoring System

**A full-stack, Hindi-first platform that lets village water volunteers record spring discharge and water quality offline, and gives NGO managers a live dashboard of spring health across Himalayan villages.**

Built and deployed for the **Central Himalayan Rural Action Group (CHIRAG)**, Uttarakhand, during a Tata Trusts-funded springshed programme (Apr - Jun 2026). Handed over to CHIRAG's field team and connected to their central server.

![Kotlin](https://img.shields.io/badge/Android-Kotlin%20%7C%20Jetpack%20Compose-7f52ff)
![Node](https://img.shields.io/badge/API-Node%2020%20%7C%20Express-339933)
![Postgres](https://img.shields.io/badge/DB-PostgreSQL%2015-336791)
![React](https://img.shields.io/badge/Dashboard-React%20%7C%20Vite%20%7C%20Tailwind-61dafb)
![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ed)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## The problem

Mountain springs (naulas and dharas) are the main drinking-water source for Himalayan villages, and many are drying or getting contaminated. Springshed programmes depend on regular discharge and water-quality readings, but those were captured on paper, arrived late, and were hard to compare across villages. Field areas have patchy connectivity and many volunteers read Hindi, not English.

## What Jal Sakhi does

| Who | What they get |
|---|---|
| **Key Resource Persons (KRPs)**, village volunteers | Hindi-first Android app that works fully offline: record spring discharge and water quality with GPS, photo and voice note, then sync automatically when signal returns |
| **CHIRAG managers** | Web dashboard with spring map, trends, BIS-standard water-quality alerts, KRP performance and approvals, Excel / PDF exports |
| **The system** | Daily SMS reminders to KRPs whose springs are due for a reading; anomaly flags on readings that break from a spring's 90-day pattern |

### Engineering highlights
- **Offline-first sync:** Room database on device, WorkManager background sync, idempotent upserts keyed on a client UUID so retries never duplicate data.
- **Data quality at source:** GPS readings rejected above 20 m accuracy; each reading checked against the spring's 90-day rolling median and flagged if anomalous.
- **Spring Health Score (0-100):** 30% discharge stability (coefficient of variation), 50% compliance with **BIS IS 10500** drinking-water limits, 20% sampling regularity.
- **Traffic-light map:** green / amber / red per spring from latest quality and test recency.
- **Auth & governance:** JWT + OTP login, KRP sign-up with manager approval, full audit log.
- **Deployable by an NGO:** Docker Compose, scripts for on-premise and VPS setup, nginx config, training manuals and quick cards in plain language.

## Architecture

```
 KRP Android app (Kotlin, Room, WorkManager)
        │  multipart POST, JWT
        ▼
 Express API (Node 20) ── node-cron 06:30 IST ──► SMS reminders
        │  SQL
        ▼
 PostgreSQL 15  (villages, springs, users, discharge, quality, audit_log, reminders)
        ▲
        │  HTTPS + JWT
 Manager dashboard (React, Leaflet, Recharts)
```
Full data-flow walkthrough: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Scale of the build

| Layer | Stack | Size |
|---|---|---|
| [`android/`](android/) | Kotlin, Jetpack Compose, Room, CameraX, WorkManager | ~3,000 lines, 35 source files |
| [`backend/`](backend/) | Node 20, Express, PostgreSQL, node-cron, OpenAPI | ~2,100 lines, 38 REST endpoints |
| [`web-dashboard/`](web-dashboard/) | React, TypeScript, Vite, Tailwind, Leaflet, Recharts, jsPDF, ExcelJS | ~3,200 lines, 10 pages |
| [`docs/`](docs/), [`deploy/`](deploy/) | Markdown, shell, nginx | Architecture, KRP manual, manager quick card, deployment guides |

## Quick start

```bash
cd backend
cp .env.example .env          # set your own secrets
docker compose up -d          # PostgreSQL + API on :8080
npm run migrate
npm run seed -- --csv ../docs/sample_springs.csv
npm run dev
```
Then open `http://localhost:8080/health` and `http://localhost:8080/docs` (Swagger). Android and dashboard setup: [`COMPLETE_SETUP_GUIDE.md`](COMPLETE_SETUP_GUIDE.md).

A signed KRP APK is in [`apk/`](apk/).

## My role

Designed and built the full system end to end as a summer intern: requirements with CHIRAG's field team, database schema, API, Android app, dashboard, deployment, and the Hindi training material for KRPs. Handed over to CHIRAG with source, deployment scripts and documentation.

**Prahlad Pratap Singh** · MBA (Forestry Management), Indian Institute of Forest Management, Bhopal

## Credits & licence

Developed for and copyright © 2026 **Central Himalayan Rural Action Group (CHIRAG)**. Released under the [MIT Licence](LICENSE). Production secrets, signing keys and server addresses are not included in this repository.
