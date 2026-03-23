import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// Ensures `serialize-javascript` can access WebCrypto in build/minification
// contexts where an unbound `crypto` identifier may be missing (e.g. Node 18).
//
// This is intentionally narrow and idempotent.
const pkgPath = path.join(process.cwd(), 'node_modules', 'serialize-javascript', 'index.js');
if (!existsSync(pkgPath)) {
  // Nothing to do (e.g. dependencies not installed yet).
  process.exit(0);
}

const src = readFileSync(pkgPath, 'utf8');
if (src.includes('globalThis.crypto') && src.includes("require('crypto').webcrypto")) {
  process.exit(0);
}

// Patch only the specific line used by generateUID().
const needle = "var bytes = crypto.getRandomValues(new Uint8Array(UID_LENGTH));";
const replacement =
  "    // `crypto` may be unavailable as a free global in some bundler/vm contexts.\n" +
  "    // Use WebCrypto from `globalThis` (and fall back to Node's webcrypto).\n" +
  "    var webcrypto = globalThis.crypto || require('crypto').webcrypto;\n" +
  "    var bytes = webcrypto.getRandomValues(new Uint8Array(UID_LENGTH));";

if (!src.includes(needle)) {
  console.warn('[patch-serialize-javascript] Expected snippet not found; skipping.');
  process.exit(0);
}

const next = src.replace(needle, replacement);
writeFileSync(pkgPath, next, 'utf8');
console.log('[patch-serialize-javascript] Patched serialize-javascript WebCrypto usage.');

