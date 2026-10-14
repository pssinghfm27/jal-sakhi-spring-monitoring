# 📋 Jal Sakhi Dashboard — Manager Quick Card

**One-page reference.** Print landscape, laminate, keep on the desk.

---

## 🔑 Sign in / लॉगिन

URL → **http://<SERVER_IP>/** · Email + Password

---

## 🗺️ Map / नक्शा — *the daily routine*

| Colour | Meaning | What to do |
|---|---|---|
| 🟢 Green | Safe + recently tested | No action |
| 🟡 Amber | Borderline OR slightly overdue | Note for next visit |
| 🔴 **Red** | **Unsafe OR overdue > 30 days** | **Call the KRP today** |

Click marker → **Open detail** for full chart + photos.

---

## 📊 What each page does

| Sidebar item | Purpose | Frequency |
|---|---|---|
| **Map** | See every spring at a glance | Daily |
| **Comparative** | Block / district rollup + trends | Weekly |
| **Alerts** | Anomalies + overdue list + **Notify KRP** button | Daily |
| **💧 Springs** | Master list — upload Excel, add/edit/deactivate | When a new spring joins |
| **📋 Readings** | Every reading ever, with filters + Excel export | Reporting time |
| **👥 KRPs** | All KRPs + their activity, edit village | Monthly review |
| **⏳ Pending KRPs** | Approve new KRP signups | **Within 24 h** |

---

## ⚠️ Three numbers you should know

| Metric | Where | When to act |
|---|---|---|
| **Health Score** (0–100) | Each spring's detail page | < 50 → field visit |
| **Anomaly dots** (red) | Discharge chart | > 50% deviation from recent average → call KRP |
| **Days Since Last Test** | Map popup / Alerts page | > 90 days → reminder; > 120 days → escalate |

---

## 💡 BIS 10500 quick reference (water-quality parameters)

| Parameter | Acceptable | Permissible (max) | Unit |
|---|---|---|---|
| pH | 6.5 – 8.5 | 6.5 – 8.5 | — |
| TDS | 0 – 500 | 2000 | mg/L |
| Turbidity | 0 – 1 | 5 | NTU |
| Hardness | 0 – 200 | 600 | mg/L as CaCO₃ |
| Alkalinity | 0 – 200 | 600 | mg/L as CaCO₃ |
| Chloride | 0 – 250 | 1000 | mg/L |
| Iron | 0 – 0.3 | 0.3 | mg/L |
| Fecal Coliform | **0 only** | 0 | MPN/100 ml |

Any reading **above permissible** = 🔴 Red on the map.

---

## 🚀 Bulk-upload springs (admin only)

1. Sidebar → **💧 Springs** → **↓ Download Template**
2. Fill the .xlsx (columns: `code, name_en, name_hi, village, gp, block, district, lat, lon, altitude_m, spring_type, project_name`)
3. **Upload Excel** → confirm row count
4. New springs are live for KRPs immediately — no app update needed

---

## 👥 KRP signup approval flow

```
KRP installs app → Sign up form → Submit
                         │
                         ▼
              You see badge in sidebar
                         │
                         ▼
              "Pending KRPs" → Approve / Reject
                         │
              ▼ (approved)         ▼ (rejected with reason)
        KRP can log in        KRP sees the reason at next login
```

---

## 🆘 Help

- App not working for KRPs → check **http://<SERVER_IP>/api/health** returns OK
- New KRP can't sign up → check village exists in **Springs → village dropdown**
- Pending count not refreshing → just reload (Cmd/Ctrl + R)
- Anything else → IT contact: `_____________________`
