#!/usr/bin/env node
// Gate: the site must not attribute itself to Tao Learning again.
// ignitecuriosity.org is a program of Curiosity Research Corporation
// (CEO ruling 2026-11-17, Curiosity-Corp/ignite-curiosity#18).
//
// Scans every tracked text file (everything on gh-pages is published by
// GitHub Pages) for:
//   - "Tao Learning" / "Tao Learner(s)" / "taolearning" (any case, any
//     space, "-" or "_" between the words), and
//   - "TLI" as a whole, upper-case word (the org's acronym), and
//   - "Dan Hup" (any case, optional space/"-"/"_"): CEO rule 2026-11-17, the
//     internship material says "our career placement team" instead.
// A hit fails the job unless scripts/old-attribution-allowlist.txt allows it
// (one entry per use: path, text on that line, reason; text "*" allows the
// whole file and is meant only for this gate's own tooling).
// An allow-list entry that no longer matches anything also fails, so the
// list stays exact.
//
//   node scripts/check-old-attribution.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWLIST = 'scripts/old-attribution-allowlist.txt';
const PATTERNS = [/tao[\s_-]*learn(?:ing|ers?)\b/i, /\bTLI\b/, /dan[\s_-]*hup/i];

function readText(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch (err) {
    // Tracked but deleted in the work tree, or a gitlink (submodule) directory.
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return null;
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
  if (buf.subarray(0, 8192).includes(0)) return null; // binary
  return buf.toString('utf8');
}

function loadAllowlist() {
  const text = readText(ALLOWLIST);
  if (text === null) throw new Error(`${ALLOWLIST} is missing`);
  const entries = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) return;
    const [path, needle, reason] = line.split('\t');
    if (!path || !needle || !reason) {
      throw new Error(`${ALLOWLIST}:${i + 1}: want "path<TAB>text on the line<TAB>reason"`);
    }
    entries.push({ path, needle, reason, lineNo: i + 1, used: false });
  });
  return entries;
}

const allow = loadAllowlist();
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && f !== ALLOWLIST);

const hits = [];
for (const file of files) {
  const text = readText(file);
  if (text === null) continue;
  text.split('\n').forEach((line, i) => {
    if (!PATTERNS.some((re) => re.test(line))) return;
    const entry = allow.find((e) => e.path === file && (e.needle === '*' || line.includes(e.needle)));
    if (entry) entry.used = true;
    else hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 200)}`);
  });
}

const stale = allow.filter((e) => !e.used);
for (const h of hits) console.error(`OLD ATTRIBUTION  ${h}`);
for (const e of stale) console.error(`STALE ALLOW-LIST ${ALLOWLIST}:${e.lineNo}: ${e.path} "${e.needle}" matches nothing`);
if (hits.length || stale.length) {
  console.error(
    `ERROR: ${hits.length} old-attribution/Dan Hup hit(s), ${stale.length} stale allow-list entr(y/ies). ` +
      'The site is a program of Curiosity Research Corporation (https://curiositycorp.org); ' +
      `run node scripts/set-owner-attribution.mjs, or allow a non-attribution use in ${ALLOWLIST} with its reason.`,
  );
  process.exit(1);
}
console.log(`OK: no old "Tao Learning"/TLI attribution or "Dan Hup" in ${files.length} tracked files (${allow.length} allow-listed uses)`);
