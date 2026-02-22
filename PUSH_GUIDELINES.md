# Push Guidelines / Richtlinien zum Pushen / ပြန်တင်ရန် လမ်းညွှန်ချက်များ

Guidelines for pushing to the SafeSphere repository **without sensitive data**. Only source and functional code should be committed.

---

## English (EN)

**Before you push:**

- **Do not commit** `.env`, `.env.local`, or any file containing API keys (Supabase, Gemini, Resend, etc.).
- **Do not commit** documents such as `.docx`, `.pdf`, `.xlsx`, or other confidential reports.
- **Do not commit** Cursor agent or IDE-specific files (`.cursor/`, `cursor-agent/`). The repo should contain only source and functional code.
- The repo `.gitignore` already excludes: `.env*` (except `.env.example`), `*.pdf`, `*.docx`, `secrets/`, `.cursor/`, and similar.

**Commit only:**

- Source code (`src/`, `index.html`, config files like `vite.config.ts`, `tsconfig.json`, etc.)
- Functional code and assets required for the app to build and run
- `.env.example` (template without real keys) and `README.md`, `PUSH_GUIDELINES.md`

Use `.env.example` as a template for other developers; keep real keys in `.env.local` locally only.

If `.cursor/` or `cursor-agent/` was ever committed, remove from the repo and stop tracking:  
`git rm -r --cached .cursor 2>/dev/null; git rm -r --cached cursor-agent 2>/dev/null; git commit -m "chore: stop tracking Cursor/agent files"`

---

## Deutsch (DE)

**Vor dem Pushen:**

- **Nicht committen:** `.env`, `.env.local` oder Dateien mit API-Schlüsseln (Supabase, Gemini, Resend usw.).
- **Nicht committen:** Dokumente wie `.docx`, `.pdf`, `.xlsx` oder andere vertrauliche Berichte.
- **Nicht committen:** Cursor-Agent- oder IDE-Dateien (`.cursor/`, `cursor-agent/`). Das Repo soll nur Quell- und funktionalen Code enthalten.
- Die `.gitignore` schließt bereits aus: `.env*` (außer `.env.example`), `*.pdf`, `*.docx`, `secrets/`, `.cursor/` und Ähnliches.

**Nur committen:**

- Quellcode (`src/`, `index.html`, Konfigurationsdateien wie `vite.config.ts`, `tsconfig.json` usw.)
- Funktionaler Code und Assets, die für Build und Lauf der App nötig sind
- `.env.example` (Vorlage ohne echte Schlüssel), `README.md`, `PUSH_GUIDELINES.md`

Echte Schlüssel nur in `.env.local` lokal verwenden.

---

## မြန်မာ (MY)

**ပြန်တင်မပြီးမီ ပြုလုပ်ရန်:**

- **မထည့်ပါနှင့်:** `.env`, `.env.local` သို့မဟုတ် API သော့များ ပါသော ဖိုင်များ (Supabase, Gemini, Resend စသည်)။
- **မထည့်ပါနှင့်:** `.docx`, `.pdf`, `.xlsx` သို့မဟုတ် အခြား လျှို့ဝှက်အစီရင်ခံစာများ။
- **မထည့်ပါနှင့်:** Cursor agent သို့မဟုတ် IDE ဖိုင်များ (`.cursor/`, `cursor-agent/`)။ repo တွင် ပရိုဂရမ်ကုဒ်နှင့် လုပ်ဆောင်ချက်ကုဒ်သာ ပါရမည်။
- `.gitignore` က ပြီးသားဖယ်ထားသည်များ: `.env*` (`.env.example` မှလွဲ၍), `*.pdf`, `*.docx`, `secrets/`, `.cursor/` စသည်။

**ဤအရာများကိုသာ commit လုပ်ပါ:**

- ပရိုဂရမ်ကုဒ် (`src/`, `index.html`, `vite.config.ts`, `tsconfig.json` စသည့် config ဖိုင်များ)
- အက်ပ်တည်ဆောက်ပြီး အလုပ်လုပ်ရန် လိုအပ်သော ကုဒ်နှင့် assets များ
- `.env.example` (သော့အစစ်မပါသော နမူနာ), `README.md`, `PUSH_GUIDELINES.md`

အခြား developer များအတွက် `.env.example` ကို နမူနာအဖြစ် အသုံးပြုပါ။ သော့အစစ်များကို `.env.local` တွင် ကွန်ပျူတာတွင်သာ ထားပါ။
