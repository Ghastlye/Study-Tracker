# Minimalist Study Tracker

A minimalist, dark-mode study tracker focused only on study time.

## Tech Stack
- Frontend: React + Tailwind + Vite
- Backend: Node.js + Express
- Auth: Email + password (JWT)
- Database: SQLite (`better-sqlite3`)

## Features
- One-click start/stop study timer
- Optional Pomodoro mode (default 25/5, customizable)
- Session log with optional subject labels
- Saved subject management (create/rename/delete) with optional custom subject text
- Editable session entries
- Insights module with `Week | Month | Year` range toggle
- Calendar period navigation (`←`, `→`, `Today`) with fixed Monday-start weekly bars
- Today total, range total, daily average, best day, and current streak
- Minimal bar chart that adapts to selected range
- Subject breakdown (blank subjects grouped as `General`, top 5 + optional `Other`)
- Floating settings modal with sidebar (`General`, `Theme`, `Account`, `Data`, `Security`)
- Server-synced settings with local fallback cache
- Account management:
  - Change email (with current password)
  - Change password
  - Delete account
- Appearance settings:
  - Light/Dark mode
  - Accent themes (`Moonstone`, `Tangerine`, `Raspberry`, `Blue`, `Green`, `Brown`)
  - Text size (`Small`, `Medium`, `Large`)
  - Reduced motion toggle
  - Density mode (`Comfortable`, `Compact`)
- Data tools:
  - Export JSON (sessions, subjects, preferences)
  - Import JSON with merge + dedupe
  - Reset all study data (confirmation required)
- Security tools:
  - Log out all sessions (re-auth with current password)
- Reliability improvements:
  - Auto-resume active timer after page reload
  - Session stop retries safely with idempotent `clientSessionKey`
  - Offline-safe session save queue (`study_session_queue_v1`) with auto-sync on reconnect
  - Stats-only refetch on week/month/year navigation for faster analytics switching
- No tasks, goals, reminders, social, notifications, or gamification

## File Structure

```text
.
├── client
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src
│       ├── App.jsx
│       ├── main.jsx
│       ├── styles.css
│       ├── components
│       │   ├── AuthForm.jsx
│       │   ├── SessionList.jsx
│       │   ├── SettingsModal.jsx
│       │   ├── StatsCard.jsx
│       │   └── TimerCard.jsx
│       └── lib
│           └── api.js
├── server
│   ├── db.js
│   ├── index.js
│   └── package.json
└── package.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

3. Start backend:

```bash
npm run dev:server
```

If file-watch mode is preferred (and your OS watcher limits allow it):

```bash
npm run dev:watch --workspace server
```

4. In another terminal, start frontend:

```bash
npm run dev:client
```

5. Open:
- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Production / Vercel
- Deploy the backend as its own Node service (Render/Railway/Fly.io/etc.) and set:
  - `JWT_SECRET`
  - `CORS_ORIGIN` (your Vercel frontend URL)
  - `WEB_APP_URL` (your Vercel frontend URL)
  - `DATABASE_PATH` (persistent storage path for SQLite)
- Deploy the frontend to Vercel and set this environment variable:
  - `VITE_API_BASE_URL=https://your-backend-domain.com`

## Notes
- SQLite DB file is created in the server folder as `server/study-tracker.db`.
- For production, set `JWT_SECRET` in environment variables.
- If the API is offline, auth/dashboard actions show `Cannot reach server at <api-host>`.
- Active timer state persists in local storage key `study_active_timer_v1`.
- Failed stop-saves are queued in `study_session_queue_v1` and retried automatically.
