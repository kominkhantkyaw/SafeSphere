# Pre-push & Vercel deploy checklist

Use this before pushing to the repo and when deploying to Vercel.

## Before pushing to the repository

- [ ] **No sensitive files committed**
  - No `.env`, `.env.local`, `.env.production`, or any file containing real API keys
  - No `.docx`, `.pdf`, `.xlsx`, or other confidential documents
  - No `*.pem`, `secrets/`, or API key files
- [ ] **Verify with Git**
  - Run `git status` and `git diff` — ensure no `.env*` (except `.env.example`) or docs with secrets are staged
  - If you use `git add .`, run `git status` again before committing
- [ ] **`.gitignore`** already excludes: `env` files, `*.pdf`, `*.docx`, `secrets/`, `**/api-key*`, `**/apiKey*`, `.vercel/`
- [ ] **Build passes**: `npm run build`

## Deploying to Vercel

- [ ] **Do not put API keys in the repo.** Set them in the Vercel project:
  - **Project → Settings → Environment Variables**
  - Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_GEMINI_API_KEY`) with your values
  - Use **Production**, **Preview**, and **Development** as needed
- [ ] **Build command**: `npm run build` (already in `vercel.json`)
- [ ] **Output directory**: `dist` (already in `vercel.json`)
- [ ] After deploy, test the live URL and that env-dependent features (e.g. Supabase, AI chat) work when vars are set.

## Quick commands

```bash
# Ensure build works
npm run build

# See what would be committed (no .env or secrets should appear)
git status
git diff --cached
```
