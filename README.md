## **Disaster Preparedness and Emergency Response Application**

**Live Demo:** [https://www.safesphere.app](https://www.safesphere.app)

This repository contains the **Final Project** submission. It evolves from the preliminary report with enhanced features including Live Command Map, USGS earthquake integration, AI Safety Assistant, German and Myanmar language support.

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

- **Node.js** v20.0.0 or higher (required for build and clean `npm audit`; v18 may hit dev-dependency issues) — [Download](https://nodejs.org/)
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
| `VITE_SUPABASE_URL`      | For online mode | Your Supabase project URL (e.g.`https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | For online mode | Supabase anon public key                                      |
| `VITE_GEMINI_API_KEY`    | For AI Chat     | [Get key](https://aistudio.google.com/apikey)                    |



### Registration confirmation — email to your inbox

When you run **`npm run dev`**, the “check your email” screen may show **Development: Your code is …** on purpose: it lets you complete sign-up locally without configuring mail. That line is **not** an email delivery failure.

To **send the 6-digit code (and branded mail) to a real address**:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then `supabase login`.
2. Link this repo to your project: `supabase link --project-ref YOUR_PROJECT_REF` (the ref is the subdomain of `VITE_SUPABASE_URL`, e.g. `abcdxyz` from `https://abcdxyz.supabase.co`).
3. Deploy the function from the project root: `npm run deploy:confirmation-email` (or `supabase functions deploy send-confirmation-email`).
4. Store your Resend key as a **Supabase secret** (not in `.env.local`):
   ```bash
   supabase secrets set RESEND_API_KEY=re_your_actual_key
   ```
5. **Gmail and most real addresses:** Resend’s default test sender often refuses arbitrary recipients. In [Resend → Domains](https://resend.com/domains), verify a domain you own, then set:
   ```bash
   supabase secrets set RESEND_FROM="SafeSphere <noreply@yourdomain.com>"
   ```
   (The address must use that verified domain.)
6. Keep **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** in `.env.local` so the app can call `…/functions/v1/send-confirmation-email` with the anon key.

**Separate from the above:** Supabase Auth may send its **own** confirmation (link or OTP). Those messages use **Authentication → SMTP** in the Supabase dashboard unless you use Supabase’s built-in limits. For reliable delivery to any inbox, enable **Custom SMTP** there (e.g. Resend’s SMTP) — see [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

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

| Role                | Email                    | Password |
| ------------------- | ------------------------ | -------- |
| **Admin**     | admin@safesphere.app     | ******** |
| **Responder** | responder@safesphere.app | ******** |
| **Reporter**  | reporter@safesphere.app  | ******** |

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
  - By using the app’s **Request Account** flow or your own registration.
- **2FA (TOTP):** Real users can enable 2FA in **Settings → Security → Two-Factor Authentication → Enable 2FA**. They scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and enter a code to verify. Supabase MFA is enabled by default.
- **Face ID / Touch ID:** Real users can turn on **Enable Face ID** in the same Security section. Changes to 2FA and Face ID use **Save** / **Discard** (like Language and Theme) so you can confirm before applying. When Face ID is enabled and the WebAuthn Edge Function is deployed, the **Face ID** and **Touch ID** buttons on the login page trigger the device’s biometric prompt (Face ID on iPhone, Touch ID on Mac). 

### Login with Google or Facebook (OAuth)

**Login with Gmail** and **Login with Facebook** on the login page use Supabase OAuth. For them to work:

1. **Redirect URLs** — In Supabase Dashboard go to **Authentication → URL Configuration**. Under **Redirect URLs**, add every URL where the app runs, for example: `https://www.safesphere.app`
2. **Site URL** — Set **Site URL** to your main app URL (e.g. `https://www.safesphere.app`).
3. **Enable providers** — In **Authentication → Providers**, enable **Google** and/or **Facebook**, then add the **Client ID** and **Client Secret** from [Google Cloud Console](https://console.cloud.google.com/) (OAuth 2.0 credentials) or [Facebook for Developers](https://developers.facebook.com/) (Facebook Login product).

---

## Scripts

| Command                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run dev`           | **Run** development server (then open http://localhost:3000)   |
| `npm run build`         | Production build (output:`dist/`)                                  |
| `npm run preview`       | **Test** production build locally (e.g. http://localhost:4173) |
| `npm run test`          | **Run** tests in watch mode (Vitest)                           |
| `npm run test:run`      | **Run** tests once (CI-friendly)                               |
| `npm run test:coverage` | Run tests with coverage report                                       |
| `npm run analyze`       | Build and open bundle analyzer                                       |

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
├── backend/          # Server-side: Supabase schema
│   └── supabase/     # Database schema (safesphere_postgres.sql)
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
| **Deployment** | DigitalOcean                          |

---

## Licence & Attribution

Developed with ❤️ to support a safer, more prepared world.

Final Project for the BSc Computer Science Programme, University of London.

**Author:** Min Khant Kyaw

---
