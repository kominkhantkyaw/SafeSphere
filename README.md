# SafeSphere

**Disaster Preparedness and Emergency Response Application**

CM3070 Final Project — BSc Computer Science, University of London

**Live Demo:** [https://www.safesphere.app](https://www.safesphere.app)

This repository contains the **Final Project** submission. It evolves from the preliminary report with enhanced features including Live Command Map, USGS earthquake integration, AI Safety Assistant, German and Myanmar language support.

---

## Overview

SafeSphere is a Progressive Web Application (PWA) for disaster preparedness and emergency response, focused on Southeast Asia. It provides incident reporting, resource mapping, role-based access, and gamified preparedness features, with offline support and multi-language capabilities.

---

## Features

### Core Functionality

- **Emergency Incident Reporting** — GPS-enabled reports with photos and urgency levels
- **Interactive Maps** — Live incident markers, resources, USGS earthquake data, and weather layers
- **Live Command Map** — Tactical simulation with responders, shelters, and air nodes
- **Safety Score System** — Gamified preparedness with checklists and XP tracking
- **Role-Based Access Control** — Admin, Responder, Reporter, and Viewer roles
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

- **Node.js** v18.0.0 or higher — [Download](https://nodejs.org/)
- **npm** v9.0.0 or higher (included with Node.js)
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and add your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable                   | Required        | Description                                                   |
| -------------------------- | --------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | For online mode | Your Supabase project URL (e.g.`https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | For online mode | Supabase anon public key                                      |
| `VITE_GEMINI_API_KEY`    | For AI Chat     | [Get key](https://aistudio.google.com/apikey)                    |

The app runs without Supabase or Gemini (uses mock data and localStorage).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Test Accounts

Demo credentials for evaluation:

| Role                | Email                    | Password     |
| ------------------- | ------------------------ | ------------ |
| **Admin**           | admin@safesphere.app     |  xxxxxxxx    |
| **Responder**       | responder@safesphere.app |  xxxxxxxx    |
| **Reporter**        | reporter@safesphere.app  |  xxxxxxxx    |
| **Viewer**          | viewer@safesphere.app    |  xxxxxxxx    |

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
4. **Create a Resend API key** at [resend.com](https://resend.com) (free tier: 100 emails/day), then set the secret:  
   `supabase secrets set RESEND_API_KEY=re_xxxxxxxxx`
5. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local` so the app can call the function.

Emails are sent from `SafeSphere <onboarding@resend.dev>` until you add and verify your own domain in Resend.

**Not receiving the confirmation email?**

1. **Deploy the Edge Function** — The app only sends email if the function is deployed: `npm run deploy:confirmation-email` (after `supabase link`).
2. **Set the Resend secret** — In Supabase: **Project → Edge Functions → send-confirmation-email → Secrets**, add `RESEND_API_KEY` with your key from [resend.com](https://resend.com). Or run: `supabase secrets set RESEND_API_KEY=re_xxxxxxxxx`.
3. **Check spam** — The first email may land in spam; add `onboarding@resend.dev` to your contacts or mark as “Not spam”.
4. **Development fallback** — When running locally (`npm run dev`), the activation screen shows a yellow box with your 6-digit code so you can complete signup without email. Use that code to activate your account while testing.
5. **Resend limits** — Free tier allows 100 emails/day; ensure your Resend account is verified and the “to” address is valid.

---

## Pushing to the repository

Push **only source and functional code**. No sensitive data, no Cursor agent or IDE-only files.

Before you push:

- **Do not commit** `.env`, `.env.local`, or any file containing API keys (Supabase, Gemini, Resend, etc.)
- **Do not commit** documents such as `.docx`, `.pdf`, or other confidential reports
- **Do not commit** `.cursor/`, `cursor-agent/`, or other Cursor/IDE-only files — the repo should not contain these
- The repo `.gitignore` already excludes: `.env*` (except `.env.example`), `*.pdf`, `*.docx`, `secrets/`, `.cursor/`, and similar

Use `.env.example` (without real keys) as a template for other developers.

### Deploy to Vercel

1. Push your branch; ensure no `.env` or API keys are committed (see above).
2. In the Vercel project: **Settings → Environment Variables**. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GEMINI_API_KEY` (values from your own `.env.local`, not from the repo).
3. Deploy; build uses `npm run build` and output directory `dist` (see `vercel.json`).

---

## Scripts

| Command                   | Description                         |
| ------------------------- | ----------------------------------- |
| `npm run dev`           | Start development server            |
| `npm run build`         | Production build (output:`dist/`) |
| `npm run preview`       | Preview production build locally    |
| `npm run test`          | Run tests (Vitest)                  |
| `npm run test:run`      | Run tests once                      |
| `npm run test:coverage` | Run tests with coverage             |
| `npm run analyze`       | Build and open bundle analyzer      |

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
