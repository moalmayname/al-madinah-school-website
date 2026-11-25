# Al-Madinah Al-Munawwarah School Website (v2)

A bilingual (Arabic / English) school website for **Al-Madinah Al-Munawwarah School**
(مدرسة المدينة المنورة), covering both **primary** and **secondary** levels, with a
Node.js + Express backend, JSON-file data storage, working contact and admissions
forms, and a rich animated frontend (3D hero cube, tilt cards, parallax, counters).

> **Placeholder data note:** Contact details (address, phone, email), teacher names/photos,
> gallery photos, testimonials and event dates are **sample placeholders** — the school
> still needs to supply the real details. Nothing on the site invents a real address,
> phone number or enrolment figures; the stat counters use only generic values
> (2 levels, 2 languages, 7+ sections, 100% commitment).

## Features

**Frontend**
- Full Arabic ⇄ English toggle — every string lives in `public/js/i18n.js`, switches
  RTL/LTR, and the choice is remembered in `localStorage`
- Sticky glass navbar with mobile menu, hero with a spinning 3D CSS cube, floating
  icons and parallax gradient background
- Animated stat counters, About cards, Academics with interactive Primary/Secondary
  tabs and a school-day timetable strip
- Teachers, News & Events and Gallery loaded from the API (with embedded fallback
  data, so the page also works opened as a static file)
- Gallery lightbox, testimonials carousel, FAQ accordion
- Multi-step admissions form (Student → Guardian → Review) that submits to the API
  and displays a reference code; contact form with success/error states
- 3D tilt-on-hover cards, scroll-reveal animations, smooth scrolling, back-to-top

**Backend**
- Express server serving the static frontend plus a small JSON API
- Seed content in editable JSON files (`server/data/*.json`)
- Contact messages and admission applications validated and stored as JSON
- Token-protected admin endpoint to review submissions

## Tech stack

- **Frontend:** HTML5, CSS3 (custom properties, CSS 3D transforms), vanilla JavaScript
- **Backend:** Node.js 18+, Express 4
- **Storage:** JSON files (seed data committed; submissions stored in gitignored runtime files)

## How to run

```bash
npm install
npm start          # production: node server/server.js
npm run dev        # development: node --watch server/server.js
```

Then open <http://localhost:3000> (set `PORT` to change the port).

No build step is required.

## API summary

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/health` | Health check → `{ status: "ok", ... }` |
| GET | `/api/news` | News items (bilingual `title_en/title_ar`, `body_en/body_ar`, `date`, `tag_*`) |
| GET | `/api/events` | Upcoming events (bilingual fields + `date_label_*`) |
| GET | `/api/teachers` | Teacher profiles (bilingual `name_*`, `role_*`, `bio_*`, `icon`) |
| GET | `/api/gallery` | Gallery tiles (`icon`, `color`, bilingual `caption_*`) |
| GET | `/api/stats` | Stat counters (`value`, `suffix`, bilingual `label_*`) |
| POST | `/api/contact` | Body: `{ name, email, phone?, message }` — validated, stored, returns `{ ok: true }` |
| POST | `/api/admissions` | Body: `{ studentName, level: "primary"\|"secondary", guardianName, guardianPhone?, guardianEmail?, notes? }` — at least one guardian contact is required. Returns `{ ok: true, reference: "ADM-2026-XXXXXX" }` |
| GET | `/api/admin/submissions` | Returns all stored contact messages + applications. **Requires header `x-admin-token: <ADMIN_TOKEN>`** |

### Admin token

The admin endpoint is protected by the `ADMIN_TOKEN` environment variable:

```bash
ADMIN_TOKEN=choose-a-long-random-value npm start
curl -H "x-admin-token: choose-a-long-random-value" http://localhost:3000/api/admin/submissions
```

If `ADMIN_TOKEN` is not set, a demo default (`change-me-demo-token`) is used so the
project runs out of the box for local testing. **Always set a real `ADMIN_TOKEN` in
production** — this is a demo-grade check, not a full auth system, and no passwords
are stored anywhere.

## Project structure

```
al-madinah-school-website/
├── README.md
├── package.json
├── .gitignore
├── public/                  # Static frontend (served by Express)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── i18n.js          # All EN/AR strings + fallback data + testimonials
│       └── app.js           # UI logic, API loading, forms, effects
└── server/
    ├── server.js            # Express app: static hosting + API routes
    ├── store.js             # Tiny JSON-file data store
    └── data/
        ├── news.json        # Seed content (committed)
        ├── events.json
        ├── teachers.json
        ├── gallery.json
        ├── stats.json
        └── runtime/         # Submissions written at runtime (gitignored)
```

## Deployment notes

- **Render / Railway / similar:** create a Web Service from the repo, build command
  `npm install`, start command `npm start`, and set the `ADMIN_TOKEN` env var.
  Note: on free tiers the filesystem may be ephemeral, so runtime submissions
  (JSON files) can be lost on redeploy — swap `server/store.js` for a database
  (e.g. SQLite/Postgres) for production use.
- **Replit:** import the project (e.g. from GitHub), click **Run** — Replit runs
  `npm start`. Set `ADMIN_TOKEN` in the Secrets tab. The site is served on the
  Replit webview URL.
- **GitHub:** `git push` the repo to GitHub as-is; `node_modules/` and runtime
  submission files are already excluded via `.gitignore`. To publish only the
  static frontend (no forms backend), GitHub Pages can serve the `public/`
  folder — the page falls back to its embedded data, and the forms will show a
  "server not reachable" message.

## Editing content

- **Text/translations:** `public/js/i18n.js`
- **News, events, teachers, gallery, stats:** `server/data/*.json` (keep the
  `*_en` / `*_ar` field pairs in sync — and mirror content changes in the
  `window.FALLBACK` copy inside `public/js/i18n.js` so static mode matches).
