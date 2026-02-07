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
| **Admin**     | admin@safesphere.app     | admin123     |
| **Responder** | responder@safesphere.app | responder123 |
| **Reporter**  | reporter@safesphere.app  | reporter123  |
| **Viewer**    | viewer@safesphere.app    | viewer123    |

---

## Database Setup (Supabase)

For online mode with real data:

1. Create a project at [supabase.com](https://supabase.com)
2. In **Project Settings → API**, copy the Project URL and anon key
3. In **SQL Editor**, run `backend/supabase/safesphere_postgres.sql` (schema + migrations included)
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`

See `backend/supabase/README.md` for details.

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
