# SafeSphere

**Disaster Preparedness and Emergency Response Application**

CM3070 Final Project — BSc Computer Science, University of London

**Live Demo:** [https://www.safesphere.app](https://www.safesphere.app)

This repository contains the **Final Project** submission. It evolves from the preliminary report with enhanced features including Live Command Map, USGS earthquake integration, AI Safety Assistant, German and Myanmar language support.



**Verhalten im Brandfall**

Im Brandfall bewahren Sie bitte Ruhe und handeln Sie besonnen.
Lösen Sie sofort den Feuermelder aus und informieren Sie die Feuerwehr über den Notruf 112.
Bringen Sie sich und andere Personen in Sicherheit, ohne sich selbst zu gefährden.

Verlassen Sie das Gebäude umgehend über die gekennzeichneten Fluchtwege.
Benutzen Sie keine Aufzüge.
Schließen Sie Türen hinter sich, aber schließen Sie sie nicht ab.

Begeben Sie sich zum ausgewiesenen Sammelplatz und bleiben Sie dort, bis weitere Anweisungen erfolgen.

Unterstützen Sie hilfsbedürftige Personen, sofern dies ohne Eigengefährdung möglich ist.
Versuchen Sie nur dann, einen Entstehungsbrand zu löschen, wenn Sie sich nicht selbst in Gefahr bringen.

Befolgen Sie stets die Anweisungen der Einsatzkräfte und der betrieblichen Brandschutzhelfer.

---

## Overview

SafeSphere is a Progressive Web Application (PWA) for disaster preparedness and emergency response, focused on Southeast Asia. It provides incident reporting, resource mapping, role-based access, and gamified preparedness features, with offline support and multi-language capabilities.

**Run locally:** `npm install` → `npm run dev` → open http://localhost:3000 → log in with a test account (see Test accounts below)  
**Run tests:** `npm run test` or `npm run test:run`

---

## Features

### Core Functionality

- **Emergency Incident Reporting** — GPS-enabled reports with photos and urgency levels
- **Interactive Maps** — Live incident markers, resources, USGS earthquake data, and weather layers
- **Live Command Map** — Tactical simulation with responders, shelters, and air nodes
- **Safety Score System** — Gamified preparedness with checklists and XP tracking
- **Role-Based Access Control** — Admin, Responder, and Reporter 
- **AI Safety Assistant** — Chat support via Google Gemini (optional)
- **Offline Capability** — Dual-mode storage: Supabase when online, localStorage when offline
- **Multilingual Support** — English, German, and Myanmar

### Key Pages

| Page                      | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| **Home**            | Dashboard with safety score, seismic chart, and quick actions    |
| **Maps**            | Live Command Map with incidents, resources, earthquakes, heatmap |
| **Prepare**         | Safety checklists, drills, and emergency guides                  |
| **Emergency (SOS)** | Quick access incident reporting                                  |
| **Chat**            | Community safety chat with optional AI assistant                 |
| **Profile**         | User management, skills, and statistics                          |
| **Learn**           | Tutorials, guides, and learning resources                        |
| **Resources**       | Discover medical, fire, police, and shelter facilities           |
| **Admin**           | Incident validation, user management (Admin role)                |
| **Settings**        | Account, notifications, privacy, and security                    |

---

## Prerequisites

- **Node.js** v18.0.0 or higher (v20+ recommended) — [Download](https://nodejs.org/)
- **npm** v9.0.0 or higher (included with Node.js)
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## Run SafeSphere (local development)

### 1. Clone and install

```bash
git clone https://github.com/kominkhantkyaw/SafeSphere
cd SafeSphere
npm install
```

### 2. Environment (optional for first run)

The app runs **without** any env vars (uses mock data and localStorage). For online storage and AI Chat:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable                   | Required        | Description                                                   |
| -------------------------- | --------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | For online mode | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | For online mode | Supabase anon public key                                      |
| `VITE_GEMINI_API_KEY`    | For AI Chat     | [Get key](https://aistudio.google.com/apikey)                 |

### 3. Start the dev server

```bash
npm run dev
```

In the terminal you’ll see something like:

```
  VITE v6.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

Open **http://localhost:3000** in your browser. The app loads with mock data if Supabase is not configured.

---

## Test accounts (demo login)

Use these to **run and test** the app with different roles. SafeSphere has **three roles only**: Admin, Responder, Reporter.

| Role        | Email                     | Password  |
| ----------- | ------------------------- | --------- |
| **Admin**   | admin@safesphere.app      | ********  |
| **Responder** | responder@safesphere.app | ********  |
| **Reporter**  | reporter@safesphere.app  | ********  |

**How to test:**

1. Run the app (`npm run dev`) and open http://localhost:3000.
2. On the login screen, use one of the emails above and the corresponding test password (e.g. **Reporter**: `reporter@safesphere.app` / test password as above).
3. After login, try: **Report incident** (SOS/Emergency), **Maps**, **Prepare**, **Chat**, **Profile**, **Settings**.
4. Log out (Menu → Sign out) and log in as **Admin** or **Responder** to test **Admin Panel** (incidents, users, resources, etc.).

---

## Testing (automated and manual)

### Run the test suite

```bash
npm run test          # Watch mode: re-runs on file changes
npm run test:run      # Single run (CI-friendly)
npm run test:coverage # Coverage report
```

Tests use **Vitest** and **React Testing Library**. They cover constants, types, and core behaviour; run them to confirm the project builds and key logic works.

### Manual testing (suggested flows)

- **Reporter:** Log in as Reporter → submit an incident (SOS/Emergency) → check confirmation; open Prepare (checklists, tutorials); use Chat (team channels, AI if `VITE_GEMINI_API_KEY` is set).
- **Responder / Admin:** Log in as Admin or Responder → open **Admin Panel** from the menu → Incidents: view list, open a report, **Approve** / **Request info** / **Resolve**; check that status updates.
- **Offline and sync:** See **[Testing Sections 14 and 15](docs/testing-sections-14-15.md)** for step-by-step verification of offline incident submission, queue, sync, and report validation (including DevTools and Supabase checks).

### Preview production build locally

```bash
npm run build
npm run preview
```

Then open the URL shown (e.g. http://localhost:4173) to test the production build.

---

## Database Setup (Supabase)

For online mode with real data:

1. Create a project at [supabase.com](https://supabase.com)
2. In **Project Settings → API**, copy the Project URL and anon key
3. In **SQL Editor**, run `backend/supabase/safesphere_postgres.sql` (schema + migrations included)
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`

See `backend/supabase/README.md` for details.

### Real users: Auth, 2FA & Face ID

- **Demo accounts** (e.g. `reporter@safesphere.app`) use mock auth only; no Supabase Auth required.
- **Real users** (any other email) sign in with **Supabase Auth** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
- In the Supabase dashboard: **Authentication → Providers → Email** enable "Confirm email" if you want verification; otherwise users can sign in right after sign-up.
- Create real users either:
  - In **Authentication → Users → Add user**, or
  - By using the app’s **Request Account** flow (if wired to Supabase sign-up) or your own registration.
- **2FA (TOTP):** Real users can enable 2FA in **Settings → Security → Two-Factor Authentication → Enable 2FA**. They scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and enter a code to verify. Supabase MFA is enabled by default.
- **Face ID / Touch ID:** Real users can turn on **Enable Face ID** in the same Security section. Changes to 2FA and Face ID use **Save** / **Discard** (like Language and Theme) so you can confirm before applying. When Face ID is enabled and the WebAuthn Edge Function is deployed, the **Face ID** and **Touch ID** buttons on the login page trigger the device’s biometric prompt (Face ID on iPhone, Touch ID on Mac). To enable this:
  1. Run `backend/supabase/webauthn_tables.sql` in the Supabase SQL Editor.
  2. Deploy the Edge Function: `supabase functions deploy webauthn`.
  3. Set **SITE_URL** in the function’s secrets (e.g. `https://your-app.vercel.app`) so the correct `rpId` is used for WebAuthn.

### Registration confirmation email (6-digit code)

When users **Request Account**, the app sends a 6-digit code to their email so they can activate the account. To actually deliver that email, use your existing Supabase project (the same one in `.env.local`):

1. **Install Supabase CLI** (if needed): [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
2. **Log in and link** your project:
   - `supabase login`
   - From `.env.local`, your `VITE_SUPABASE_URL` is like `https://YOUR_PROJECT_REF.supabase.co` — the project ref is the part before `.supabase.co`.
   - Run: `supabase link --project-ref YOUR_PROJECT_REF`
3. **Deploy the function**: `npm run deploy:confirmation-email` (or `supabase functions deploy send-confirmation-email`).
4. **Create a Resend API key** at [resend.com](https://resend.com) (free tier: 100 emails/day), then set the secret:`supabase secrets set RESEND_API_KEY=re_xxxxxxxxx`
5. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local` so the app can call the function.

Emails are sent from `SafeSphere <onboarding@resend.dev>` until you add and verify your own domain in Resend.

**Not receiving the confirmation email?**

1. **Deploy the Edge Function** — The app only sends email if the function is deployed: `npm run deploy:confirmation-email` (after `supabase link`).
2. **Set the Resend secret** — In Supabase: **Project → Edge Functions → send-confirmation-email → Secrets**, add `RESEND_API_KEY` with your key from [resend.com](https://resend.com). Or run: `supabase secrets set RESEND_API_KEY=re_xxxxxxxxx`.
3. **Check spam** — The first email may land in spam; add `onboarding@resend.dev` to your contacts or mark as “Not spam”.
4. **Development fallback** — When running locally (`npm run dev`), the activation screen shows a yellow box with your 6-digit code so you can complete signup without email. Use that code to activate your account while testing.
5. **Resend limits** — Free tier allows 100 emails/day; ensure your Resend account is verified and the “to” address is valid.

### Password reset email (Supabase Auth)

**Forgot password** uses Supabase Auth's built-in reset flow: the app requests a reset link and Supabase sends the email. By default Supabase only sends auth emails to **addresses added as project team members** and has a low rate limit (~2/hour). To deliver reset emails to Gmail, iCloud, etc., configure **Custom SMTP** in Supabase (e.g. Resend, which you may already use for confirmation emails):

1. In **Supabase Dashboard** go to **Authentication → SMTP** ([Auth → SMTP](https://supabase.com/dashboard/project/_/auth/smtp)).
2. **Enable Custom SMTP** and enter your provider's settings. For **Resend**:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (or `587`)
   - **Username:** `resend`
   - **Password:** your Resend API key (`re_xxxxxxxxx`)
   - **Sender email:** e.g. `no-reply@yourdomain.com` (or Resend's default until you verify a domain)
   - **Sender name:** e.g. `SafeSphere`
3. Save. Auth emails (password reset, magic link, confirmations sent by Supabase) will then go through Resend to any recipient.
4. In **Authentication → URL Configuration**, set **Site URL** to your app (e.g. `https://www.safesphere.app`) and add the same URL (and `https://safesphere.app` if you use it) under **Redirect URLs**.

If you don't set Custom SMTP, only team-member emails receive the reset link; others will not get an email.

---

### Deploy to Vercel

1. Push your branch; ensure no `.env` or API keys are committed (see below).
2. In the Vercel project: **Settings → Environment Variables**. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GEMINI_API_KEY` (values from your own `.env.local`, not from the repo).
3. Deploy; build uses `npm run build` and output directory `dist` (see `vercel.json`).

---

## Pushing to the repository

**Repo:** [https://github.com/kominkhantkyaw/SafeSphere](https://github.com/kominkhantkyaw/SafeSphere)

Push **only source and functional code**. No sensitive data, no Cursor agent or IDE-only files. The project is set up so you can push **without** committing `.md` files (except this `README.md`).

Before you push:

- **Do not commit** `.env`, `.env.local`, or any file containing API keys (Supabase, Gemini, Resend, etc.)
- **Do not commit** documents such as `.docx`, `.pdf`, or other confidential reports
- **Do not commit** `.md` files other than `README.md` — the `.gitignore` excludes `*.md` and keeps only `README.md`, so pushes do not include other markdown files
- **Do not commit** `.cursor/`, `cursor-agent/`, or other Cursor/IDE-only files

The `.gitignore` already excludes: `.env*` (except `.env.example`), `*.pdf`, `*.docx`, `*.md` (except `README.md`), `docs/`, `secrets/`, `.cursor/`, and similar.

Use `.env.example` (without real keys) as a template for other developers.

---

## Scripts

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | **Run** development server (then open http://localhost:3000) |
| `npm run build`           | Production build (output: `dist/`)               |
| `npm run preview`         | **Test** production build locally (e.g. http://localhost:4173) |
| `npm run test`            | **Run** tests in watch mode (Vitest)             |
| `npm run test:run`        | **Run** tests once (CI-friendly)                 |
| `npm run test:coverage`   | Run tests with coverage report                   |
| `npm run analyze`         | Build and open bundle analyzer                   |

---

## Project Structure

```
SafeSphere/
├── src/
│   ├── components/   # Reusable UI components
│   ├── contexts/     # React contexts (User, Language)
│   ├── pages/        # Main application pages
│   ├── services/     # API, Supabase, AI Chat, Weather
│   ├── types/        # TypeScript type definitions
│   ├── constants/    # Mock data and app constants
│   ├── styles/       # Global CSS
│   ├── __tests__/    # Unit tests
│   ├── App.tsx       # Root component
│   └── main.tsx      # Entry point
├── backend/          # Server-side: Supabase schema, setup; reserved for future API code
│   └── supabase/     # Database schema (safesphere_postgres.sql) and setup
├── scripts/          # Build utilities
├── index.html        # HTML template
├── vite.config.ts    # Vite configuration
└── vercel.json       # Vercel deployment config
```

---

## Technology Stack

| Category             | Technology                      |
| -------------------- | ------------------------------- |
| **Frontend**   | React 19, TypeScript            |
| **Styling**    | Tailwind CSS                    |
| **Build**      | Vite 6                          |
| **Backend**    | Supabase (PostgreSQL, optional) |
| **Maps**       | Leaflet.js, OpenStreetMap       |
| **AI**         | Google Gemini (optional)        |
| **Icons**      | Lucide React                    |
| **Testing**    | Vitest, Testing Library         |
| **Deployment** | Vercel                          |

---

## Deployment (Vercel)

1. Push the project to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`
4. Deploy (Vite is auto-detected; `vercel.json` handles SPA routing)

---

## Troubleshooting

### Port in use

Vite will try the next available port (3001, 3002, …). Check the terminal for the actual URL.

### npm install fails

1. Remove `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure Node.js v18+: `node --version`

### Supabase connection issues

- Confirm `VITE_SUPABASE_URL` is your project URL (e.g. `https://xxxxx.supabase.co`), not `https://www.supabase.co`
- Check firewall and network access
- `.env.local` is never committed; ensure it exists and is loaded

### AI Chat shows "quota limit"

The Gemini API key is valid but the free-tier quota is exceeded. Wait a few minutes or check usage in [Google AI Studio](https://aistudio.google.com/).

---

## Additional Resources

| Resource                       | Location                                     |
| ------------------------------ | -------------------------------------------- |
| **Database schema**      | `backend/supabase/safesphere_postgres.sql` |
| **ER diagrams**          | `ER_Diagrams.md`                           |
| **Supabase setup**       | `backend/supabase/README.md`               |
| **User flow diagrams**   | `docs/user-flow-diagram.md`                |
| **Testing Sections 14 & 15** (offline/sync, validation) | `docs/testing-sections-14-15.md` |
| **Storage configuration** (online/offline) | `docs/storage-configuration.md` |
| **Documentation**        | `documentation.html`                       |
| **User feedback survey** | `docs/Final_User_Feedback_Survey.md`       |
| **Preliminary report**   | `docs/Preliminary_Report final.docx`       |

---

## Security Note

Never commit `.env.local` or expose API keys. Use environment variables for all secrets. The project uses `VITE_`-prefixed variables for client-side configuration.

---

## Support

For evaluation and assessment, please refer to:

- The preliminary report and documentation for project context
- Inline code comments for implementation details
- The live demo at [safesphere.app](https://www.safesphere.app) for hands-on testing

---

## Licence & Attribution

Developed with ❤️ for a safer, more prepared world.

Final Project for the BSc Computer Science Programme, University of London.

**Author:** Min Khant Kyaw

---
