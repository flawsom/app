#!/usr/bin/env node
/**
 * UNIFY i18n parity check.
 *
 * Compares every non-English translation file against en.json and fails
 * (exit 1) if any translation key is missing. Run locally or in CI to
 * prevent regressions whenever new strings are introduced.
 *
 *     node scripts/i18n-parity.js
 *     # or: yarn i18n:check
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'frontend', 'src', 'i18n');
const BASE = 'en';
const LOCALES = ['hi', 'te', 'ta', 'or'];

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function load(locale) {
  const p = path.join(I18N_DIR, `${locale}.json`);
  if (!fs.existsSync(p)) {
    console.error(`[i18n] missing file: ${p}`);
    process.exit(1);
  }
  return flatten(JSON.parse(fs.readFileSync(p, 'utf8')));
}

const base = load(BASE);
const baseKeys = Object.keys(base);
let totalMissing = 0;
const report = [];

for (const locale of LOCALES) {
  const other = load(locale);
  const missing = baseKeys.filter((k) => !(k in other));
  const extras = Object.keys(other).filter((k) => !(k in base));
  report.push({ locale, missing, extras });
  totalMissing += missing.length;
}

console.log('\nUNIFY i18n parity report');
console.log('─'.repeat(40));
console.log(`Base (${BASE}): ${baseKeys.length} keys`);
for (const r of report) {
  const status = r.missing.length === 0 ? '✓' : '✗';
  console.log(`${status} ${r.locale}: ${baseKeys.length - r.missing.length}/${baseKeys.length} keys`);
  if (r.missing.length) {
    console.log(`    missing: ${r.missing.join(', ')}`);
  }
  if (r.extras.length) {
    console.log(`    extras (not in ${BASE}): ${r.extras.join(', ')}`);
  }
}
console.log('─'.repeat(40));
if (totalMissing > 0) {
  console.error(`\nFAIL — ${totalMissing} missing translation key(s) across ${LOCALES.length} locales.\n`);
  process.exit(1);
}
console.log('\nOK — full parity across all locales.\n');
