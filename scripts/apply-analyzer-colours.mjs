#!/usr/bin/env node
/**
 * Applies distinct colours to the bundle analyzer (stats.html) for easier
 * differentiation of Rendered, Gzip, Brotli size selectors and treemap modules.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const statsPath = join(__dirname, '..', 'dist', 'stats.html');

const SIZE_SELECTOR_CSS = `
/* Teal/cyan palette for Rendered, Gzip, Brotli – vibrant on dark background */
label[for="selector-renderedLength"] { color: #2dd4bf !important; font-weight: 600; }
label[for="selector-renderedLength"]::before { content: "● "; color: #14b8a6; }

label[for="selector-gzipLength"] { color: #22d3ee !important; font-weight: 600; }
label[for="selector-gzipLength"]::before { content: "● "; color: #06b6d4; }

label[for="selector-brotliLength"] { color: #38bdf8 !important; font-weight: 600; }
label[for="selector-brotliLength"]::before { content: "● "; color: #0ea5e9; }

.size-selector:has(input:checked) label { border-bottom: 2px solid currentColor; padding-bottom: 2px; }
`;

try {
  let html = readFileSync(statsPath, 'utf8');

  // 1. Replace treemap colour palette – teal/cyan/blue gradient (impressive on dark background)
  const oldPalette = /hsl\(360\s*\*\s*n\s*,\s*0\.3\s*,\s*0\.85\)/g;
  const newPalette = 'hsl(170 + (n * 24) % 80, 0.65, 0.55)';
  html = html.replace(oldPalette, newPalette);
  // Also replace previously applied palette if user re-runs after a prior run
  const prevPalette = /hsl\(\d+\s*\+\s*\(n\s*\*\s*\d+\)\s*%\s*\d+,\s*[\d.]+,\s*[\d.]+\)/g;
  html = html.replace(prevPalette, newPalette);

  // 2. Inject distinct colours for Rendered, Gzip, Brotli selectors
  const styleClose = '</style>';
  if (html.includes(styleClose) && !html.includes('selector-renderedLength')) {
    html = html.replace(styleClose, `${SIZE_SELECTOR_CSS}\n  ${styleClose}`);
  }

  writeFileSync(statsPath, html);
  console.log('✓ Applied distinct colours (Rendered/Gzip/Brotli + treemap)');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('⚠ stats.html not found – run "npm run analyse" first');
  } else {
    throw err;
  }
}
