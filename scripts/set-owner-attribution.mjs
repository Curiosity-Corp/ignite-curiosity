#!/usr/bin/env node
// Point the site's ownership attribution at Curiosity Research Corporation
// (https://curiositycorp.org). CEO ruling 2026-11-17, Curiosity-Corp/ignite-curiosity#18.
//
// The site has no shared footer source, so this rewrites every tracked .html
// file in place. It is idempotent: a second run changes nothing.
//
//   node scripts/set-owner-attribution.mjs          # rewrite, list changed files
//   node scripts/set-owner-attribution.mjs --check  # exit 1 if any file would change
//
// Legal or factual sentences about Tao Learning (tax status, registered names)
// are deliberately NOT rewritten here; they are listed in
// scripts/old-attribution-allowlist.txt and on the issue with needs::decision.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OWNER = 'Curiosity Research Corporation';
const OWNER_URL = 'https://curiositycorp.org';
const OWNER_LINK =
  `<a href="${OWNER_URL}" target="_blank" rel="noopener" class="footer-owner" ` +
  `style="display:block;margin:6px 0 14px;font-size:18px;font-weight:700;line-height:1.3;color:#fff;">${OWNER}</a>`;

// Each rule: [description, pattern, replacement, optional page predicate].
const RULES = [
  [
    'footer: Tao Learning mark (logo_tli_dark.svg) -> owner name as text link',
    /<a href="https?:\/\/(?:www\.)?(?:curiositycorp|taolearning)\.org\/?"[^>]*>\s*<div>\s*<div class="navbar-brand">\s*<object data="[^"]*logo_tli_dark\.svg"[^>]*>\s*(?:<img[^>]*>\s*)?<\/object>\s*<\/div>\s*<\/div>\s*<\/a>/g,
    OWNER_LINK,
  ],
  [
    'older footer (GUIDE STAR column, no "A PROGRAM OF"): owner line under the site description',
    /(<p>Ignite Curiosity is a learning community[^<]*<\/p>(?:\s*<a [^>]*><i class="fa fa-angle-right"><\/i> Read More<\/a>)?)/,
    `$1\n\t\t\t\t\t\t\t<div class="footer-title" style="margin-top:24px;">A PROGRAM OF</div>\n\t\t\t\t\t\t\t${OWNER_LINK}`,
    // Only on pages that still have no owner line at all; the GUIDE STAR seal
    // (Tao Learning Institute's charity profile) is left as it is (needs::decision).
    (src) => !src.includes('class="footer-owner"') && src.includes('GUIDE STAR'),
  ],
  [
    'body copy: "Tao Management offers you that platform" -> owner',
    /\bTao Management offers you that platform\b/g,
    `${OWNER} offers you that platform`,
  ],
  [
    'home: "Run for the Tao Community!" -> Ignite Curiosity community',
    /Run for the Tao Community!/g,
    'Run for the Ignite Curiosity community!',
  ],
  [
    'orphan spark/index2.html: "Join Tao Learner as fresh interns" -> Ignite Curiosity',
    /Join Tao Learner as fresh interns/g,
    'Join Ignite Curiosity as fresh interns',
  ],
  [
    'home: event hashtag "#TaoScholarRun" -> "#ScholarRun"',
    /#TaoScholarRun\b/g,
    '#ScholarRun',
  ],
  [
    'meta author TaoFruit -> ignitecuriosity.org (matches the other pages)',
    /<meta name="author" content="TaoFruit"\s*\/?>/g,
    '<meta name="author" content="ignitecuriosity.org" />',
  ],
];

const check = process.argv.includes('--check');
const files = execFileSync('git', ['ls-files', '*.html'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const counts = new Map(RULES.map(([d]) => [d, 0]));
const changed = [];
for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
  let out = src;
  for (const [desc, re, rep, when] of RULES) {
    if (when && !when(out)) continue;
    const n = (out.match(re) || []).length;
    if (n) {
      counts.set(desc, counts.get(desc) + (re.global ? n : 1));
      out = out.replace(re, rep);
    }
  }
  if (out !== src) {
    changed.push(file);
    if (!check) writeFileSync(file, out);
  }
}

for (const [desc, n] of counts) console.log(`${String(n).padStart(4)}  ${desc}`);
console.log(`${changed.length} file(s) ${check ? 'would change' : 'changed'}`);
for (const f of changed) console.log(`  ${f}`);
if (check && changed.length) process.exit(1);
