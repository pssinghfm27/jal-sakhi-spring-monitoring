# 🎥 Jal Sakhi Dashboard — Recording Script for Managers & Admins

**Target length: 8–10 minutes.** Speak naturally; the on-screen labels are bilingual so visuals carry most of the meaning.

## Before you start

- Open `http://<SERVER_IP>/` (your manager dashboard) in **Chrome or Firefox** (Safari hides the dev controls).
- Log in as `manager@chirag.org` (or your real manager account) so the role-specific tabs are visible.
- Resize the browser window to roughly 1440 × 900 — that's a clean 16:9 aspect and everything fits.
- Use **macOS Screen Recording**: press **⌘ + Shift + 5** → choose "Record Selected Portion" → drag a rectangle around the browser window → **Options → Microphone: built-in → Record**. Stop with the menu-bar icon when done.
- Pre-create one demo KRP signup before recording (so the badge in the sidebar shows "1") — gives you something live to demonstrate.

---

## Recording outline (10 sections, ~50–60 sec each)

### 1. Intro & Login — *60 sec*

> "Welcome to the CHIRAG Jal Sakhi manager dashboard. This is where you'll monitor every spring reading taken by KRPs across all villages. Let me show you how to use every feature."
>
> "Open `http://<SERVER_IP>/` in any browser. Enter your manager email and password and click Sign in."

**Show**: typing the URL → login screen → entering credentials → landing on the Map.

> "CHIRAG जल साखी डैशबोर्ड — यहाँ आप हर KRP के द्वारा दर्ज की गई स्रोत की जानकारी देख सकते हैं।"

### 2. The Map view (default landing) — *90 sec*

> "When you sign in, you land on the **Map of Uttarakhand**. Every spring in our master list is plotted here."

**Show**: the map with markers.

> "The colour of each marker tells you the spring's status at a glance:
> - 🟢 **Green** — all water-quality parameters within BIS limits AND last test taken within 90 days.
> - 🟡 **Amber** — one or two parameters borderline, OR sampling overdue by less than 30 days.
> - 🔴 **Red** — any parameter unsafe, OR sampling overdue more than 30 days. **Look at red markers first.**"

**Show**: clicking the filter chips (green / amber / red / unknown) at the top — markers update.

> "Use these chips to filter. Click any marker to see the spring's summary, then click 'Open detail' for the full report."

**Show**: click one marker → its popup → click "Open detail".

### 3. Spring detail page — *90 sec*

> "This is the most important page for monitoring a single spring. You'll see five things:"

**Show, pointing to each**:
1. **Header** — spring name (Hindi + English), village, block, district, GPS, code.
2. **Health Score** — a single number from 0 to 100 showing this spring's overall condition.
   > "Below 50 means action needed; 50–75 is OK; above 75 is healthy. The breakdown shows discharge stability, BIS compliance, and sampling regularity."
3. **Discharge chart** — line graph of all flow measurements over time.
   > "Red dots mean an anomaly — the reading differs by more than 50% from the recent average. Worth a call to the KRP to confirm."
4. **Comparative toggle** — click "This Q vs Last Q" or "This Q vs LY".
   > "Compares this quarter's average to the previous quarter, or to the same quarter last year. Useful for detecting drying springs."
5. **Eight quality charts** below — pH, TDS, turbidity, hardness, alkalinity, chloride, iron, fecal coliform.
   > "Each chart shows the BIS-acceptable range as a green band. When the line goes above the band, the parameter is unsafe."

**Show**: photo gallery scrolling at the bottom.
> "Every reading comes with a KRP-uploaded photo of the measurement setup. Click any to enlarge — useful for verifying the reading was actually taken."

> "Top-right: **Export PDF** gives you a one-page report you can email; **Export Excel** gives you all this data for offline analysis."

**Show**: Click Export PDF → it downloads → open it briefly to show it works.

### 4. Comparative dashboard — *60 sec*

**Show**: click **Comparative** in sidebar.

> "This page rolls up the entire programme. The **Block table** shows every block with average discharge, % change versus the previous 90 days, and the green/amber/red mix of springs."
>
> "**Best springs** and **needing attention** lists below let you scan quickly. The district bar chart gives you the high-level picture for funder reports."

**Show**: hover on the bar chart so the tooltip values appear.

### 5. Alerts panel — *60 sec*

**Show**: click **Alerts** in sidebar.

> "Two lists here. Top: **anomalies** in the last 60 days — readings the system flagged automatically. Bottom: **overdue sampling** — springs that haven't been tested in 120+ days."
>
> "Each row has a **Notify KRP** button. Click it and the KRP gets an in-app message immediately — they'll see it on their Reminders screen next sync."

**Show**: hover Notify KRP, optionally click and confirm the toast.

### 6. Pending KRPs (the approval flow) — *75 sec*

**Show**: click **Pending KRPs** (shows the amber badge if any pending).

> "When a new KRP installs the app and signs up, their request lands here. You see their name, mobile number, village, and any note they wrote."
>
> "Click **Approve** to grant access — the KRP can log in immediately."
>
> "Or click **Reject…** to deny with a written reason. The KRP sees your reason when they try to log in. Use this if the phone number doesn't match a real KRP we've trained."

**Show**: open the reject dialog briefly (you don't have to actually submit).

> "The badge in the sidebar refreshes every minute so you'll always notice new requests."

### 7. Springs Management (the new admin power) — *90 sec*

**Show**: click **💧 Springs**.

> "This is where admins manage the master list of every CHIRAG spring."
>
> "Top-right: **Download Template** gives you a blank Excel with all the right columns. Fill it with the springs you want to add — code, name, village, block, district, GPS coordinates."
>
> "Then click **Upload Excel** and pick your filled file."

**Show**: click Download Template → file downloads → optionally open in Numbers to show columns → close.

> "After upload, the system tells you how many were created, updated, or had errors. All new springs immediately become available in the KRP app's 'Select Spring' dropdown — KRPs will see them next time they record."
>
> "You can also create, edit, or deactivate any single spring from this table — useful if a spring dries up permanently or if you need to fix a GPS coordinate."

**Show**: click the Edit pencil on one row → form opens → close without saving.

### 8. Readings Explorer — *45 sec*

**Show**: click **📋 Readings**.

> "Every individual reading ever taken by every KRP is here. Filter by spring, village, KRP, or date range to find what you need. Export the filtered set as Excel for analysis or reporting."

**Show**: apply one filter, see the count update.

### 9. KRP Management — *60 sec*

**Show**: click **👥 KRPs**.

> "Every KRP, approved or pending or rejected, with their stats — how many discharge and quality readings they've recorded, and when they were last active."
>
> "The activity badge on Last Active turns red if a KRP hasn't recorded anything in 45 days — gives you a quick view of who needs follow-up."
>
> "Edit any KRP to reassign them to a different village, change their name, or temporarily deactivate them."

**Show**: hover the last-active column on a few rows.

### 10. Wrap-up & best-practice routine — *45 sec*

> "A typical monitoring routine for a CHIRAG manager:
>
> 1. **Every morning** — open the dashboard, click any red marker, follow up with the KRP if there's an unsafe reading.
> 2. **Every week** — check the Alerts page for new anomalies and overdue tests.
> 3. **Whenever a new KRP signs up** — approve them within 24 hours.
> 4. **Every quarter** — use the Comparative page to write your progress report; download spring-detail PDFs for individual case studies.
>
> "All data stays on CHIRAG's own server at headquarters. No third party sees the spring data. If anything ever breaks, contact the IT team — but the system is designed to keep running through power cuts and internet outages."
>
> "धन्यवाद — Thank you for protecting Uttarakhand's springs."

**Show**: final shot of the map view with a few markers visible.

---

## Recording tips

- **Use 2× speed in your video editor** for the section where you scroll through long lists — keeps the video tight.
- **Add chapter markers** in your video editor (YouTube auto-detects them if you put timestamps in the description) so viewers can jump to the section they need.
- **Mute system notifications** before recording (System Settings → Focus → Do Not Disturb).
- **Hide other tabs** in your browser — single CHIRAG tab only.
- **Practice once** without recording to find the timing.

## Suggested filename

`CHIRAG_Jal_Sakhi_Manager_Walkthrough_v1.mp4`

## Distribute via

- WhatsApp Business broadcast to managers (compresses to ~50 MB, fine)
- Upload to YouTube as **Unlisted** + share the link in WhatsApp (no quality loss, free)
- Save to a shared CHIRAG Google Drive folder
