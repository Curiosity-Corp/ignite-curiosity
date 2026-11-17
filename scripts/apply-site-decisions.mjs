#!/usr/bin/env node
// Apply the Admiral decisions on the copy left verbatim by #18
// (Curiosity-Corp/ignite-curiosity#19, note 409258) to every tracked .html file.
// The site has no shared layout source, so the edits are made page by page,
// repeatably. Idempotent: a second run changes nothing.
//
//   node scripts/apply-site-decisions.mjs          # rewrite, list changed files
//   node scripts/apply-site-decisions.mjs --check  # exit 1 if any file would change
//
// Decision 1 (the footer "Non Profit Organization ... P-20+ Initiative" line)
// is deliberately NOT touched: Atlas holds it.
// register.html (decision 5) was a one-page edit and is not repeated here.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SEAL_COLUMN =
  /\n[ \t]*<div class="col-sm-3 col-md-3">\s*<div class="footer-item">\s*<div class="footer-title">\s*GUIDE STAR\s*<\/div>\s*<p><a href="https:\/\/www\.guidestar\.org\/Profile\/9759491"[^>]*><img (?:src|href)="[^"]*put-platinum2019-seal\.png"><\/a><\/p>\s*<\/div>\s*<\/div>/;

// Each rule: [description, (src, file) => new src].
const RULES = [
  [
    'decision 2: "progress of Tao Learners, as a selfless and non-profitable organization" -> "progress of learners"',
    (src) => src.replace(/progress of Tao Learners, as a selfless and non-profitable organization\./g, 'progress of learners.'),
  ],
  [
    'decision 4: older footer drops the GuideStar 2019 seal column (another organisation\'s award); the 3 columns left widen to thirds',
    (src) => {
      const start = src.indexOf('<!-- FOOTER SECTION -->');
      const end = src.indexOf('<div class="fcopy">', start);
      if (start < 0 || end < 0) return src;
      const footer = src.slice(start, end);
      if (!SEAL_COLUMN.test(footer)) return src;
      const fixed = footer.replace(SEAL_COLUMN, '').replaceAll('class="col-sm-3 col-md-3"', 'class="col-sm-4 col-md-4"');
      return src.slice(0, start) + fixed + src.slice(end);
    },
  ],
  [
    'decision 5: skills pages drop the reCAPTCHA script and its "TLI Member Registration" action (they have no form)',
    (src, file) => {
      if (!file.startsWith('skills/')) return src;
      return src
        .replace(/\n[ \t]*<script>\s*grecaptcha\.ready\(function\(\) \{[^<]*?TLI Member Registration[\s\S]*?<\/script>/g, '')
        .replace(/\n[ \t]*<script src='https:\/\/www\.google\.com\/recaptcha\/api\.js\?render=[^']*'><\/script>/g, '');
    },
  ],
  [
    'decision 7: drop the empty Power BI "See Usage" footer link',
    (src) => src.replace(/\n[ \t]*<li><a class="nav-link" target="_blank" href="https:\/\/app\.powerbi\.com\/view\?r=[^"]*">See Usage<\/a><\/li>/g, ''),
  ],
  [
    'decision 6: info/ email templates use Ignite Curiosity / Curiosity Research Corporation wording',
    (src, file) => {
      if (!file.startsWith('info/')) return src;
      return src
        .replace(/<title>Tao Mgt Solutions<\/title>/g, '<title>Ignite Curiosity</title>')
        .replace(/I manage the (<span[^>]*>)Tao Mentor<\/span> program/g, 'I manage the $1Ignite Curiosity Mentor</span> program')
        .replace(/(<td[^>]*>)Tao Mentor<\/td>/g, '$1Ignite Curiosity Mentor<br />Curiosity Research Corporation</td>')
        .replace(
          /central plaftorm for students and apprentices with ([\s\S]*?), and the <a([^>]*) href="https:\/\/taocampus\.com">Tao University<\/a>\./g,
          'central platform for students and apprentices with $1, and <a$2 href="https://curiositycorp.org">Curiosity Research Corporation</a>.',
        )
        .replace(/href="https:\/\/taomgt\.com\/connect"/g, 'href="https://ignitecuriosity.org/advocate.html"');
    },
  ],
];

const check = process.argv.includes('--check');
const files = execFileSync('git', ['ls-files', '*.html'], { encoding: 'utf8' }).split('\n').filter(Boolean);

const counts = new Map(RULES.map(([d]) => [d, 0]));
const changed = [];
for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') continue; // deleted in the work tree, not yet committed
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
  let out = src;
  for (const [desc, apply] of RULES) {
    const next = apply(out, file);
    if (next !== out) counts.set(desc, counts.get(desc) + 1);
    out = next;
  }
  if (out !== src) {
    changed.push(file);
    if (!check) writeFileSync(file, out);
  }
}

for (const [desc, n] of counts) console.log(`${String(n).padStart(4)} page(s)  ${desc}`);
console.log(`${changed.length} file(s) ${check ? 'would change' : 'changed'}`);
for (const f of changed) console.log(`  ${f}`);
if (check && changed.length) process.exit(1);
