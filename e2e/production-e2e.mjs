#!/usr/bin/env node
// Production e2e runner (hypervoid/admiral#123, Curiosity-Corp/overview#6).
//
//   node scripts/production-e2e.mjs -- npx playwright test ...
//
// 1. Preflight: resolve the site's host from this CI pod. A fleet resolver can send our apex domains
//    to the internal Ziti ingress (FocusApiary/ziti#215, developerdojo#126). A test against that
//    answer would not be testing the public site, so an internal answer fails the run, by name.
// 2. Runs the command after "--" (the Playwright suite) with a JSON reporter.
// 3. Writes production-e2e/note.md: site, pass or fail, counts, failed tests, pipeline link and the
//    full-page landing screenshot, and posts it as a note on the unit item (default
//    Curiosity-Corp/overview#6) when CURIOSITY_OVERVIEW_NOTE_TOKEN is set (masked CI variable; a
//    token that can upload files to and comment on that project). Without the token the note stays
//    a job artifact and the log says so.
// Exit code: the suite's. A failed post exits 3 (tests passed but nobody was told).
//
// Same file in Curiosity-Corp/developerdojo, curiosity-corp and ignite-curiosity; change all three.
import { spawn } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { relative, resolve } from 'node:path';

const OUT_DIR = 'production-e2e';
const RESULTS = `${OUT_DIR}/results.json`;
const NOTE = `${OUT_DIR}/note.md`;
const env = process.env;

function fail(message) {
  console.error(`production-e2e: ${message}`);
  process.exit(2);
}

const baseUrl = env.E2E_BASE_URL;
if (!baseUrl) fail('E2E_BASE_URL is not set (the public URL to test, e.g. https://developerdojo.org).');
let host;
try {
  host = new URL(baseUrl).hostname;
} catch (error) {
  fail(`E2E_BASE_URL is not a URL: ${baseUrl} (${error.message})`);
}
const site = env.PRODUCTION_E2E_SITE || host;
const screenshot = env.PRODUCTION_E2E_SCREENSHOT || `${OUT_DIR}/landing-desktop.png`;
const noteProject = env.PRODUCTION_E2E_NOTE_PROJECT || 'Curiosity-Corp/overview';
const noteIssue = env.PRODUCTION_E2E_NOTE_ISSUE || '6';
const tokenName = 'CURIOSITY_OVERVIEW_NOTE_TOKEN';

const separator = process.argv.indexOf('--');
const command = separator === -1 ? [] : process.argv.slice(separator + 1);
if (command.length === 0) fail('usage: production-e2e.mjs -- <test command...>');

// RFC 1918, CGNAT (Ziti hands out 100.64.0.0/10), loopback, link-local, ULA.
function isInternal(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254);
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

async function preflight() {
  let answers;
  try {
    answers = (await lookup(host, { all: true })).map((entry) => entry.address);
  } catch (error) {
    return { ok: false, answers: [], reason: `DNS lookup of ${host} failed in the CI pod: ${error.code ?? error.message}` };
  }
  const internal = answers.filter(isInternal);
  if (internal.length > 0) {
    return {
      ok: false,
      answers,
      reason: `the CI pod resolves ${host} to internal ${internal.join(', ')} (Ziti intercept, FocusApiary/ziti#215), not the public site`,
    };
  }
  return { ok: true, answers };
}

function run(argv) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      stdio: 'inherit',
      env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS },
    });
    child.on('error', (error) => {
      console.error(`production-e2e: could not start ${argv[0]}: ${error.message}`);
      resolve(127);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
}

async function summarise() {
  let report;
  try {
    report = JSON.parse(await readFile(RESULTS, 'utf8'));
  } catch (error) {
    return { stats: null, failures: [], error: `no Playwright JSON report at ${RESULTS} (${error.code ?? error.message})` };
  }
  const failures = [];
  const walk = (suite, trail) => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok) continue;
      const failed = (spec.tests ?? []).filter((t) => t.status === 'unexpected');
      const projects = [...new Set(failed.map((t) => t.projectName))];
      // The first line that says what went wrong: the assertion message plus the first received value.
      const message = (failed[0]?.results ?? []).map((r) => r.error?.message ?? '').find(Boolean) ?? '';
      const lines = message.replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
      const cause = [lines[0], (lines.find((l) => /^\+\s+"/.test(l)) ?? lines.find((l) => l.startsWith('+ ') && !/^\+ (Received|Array \[)/.test(l)))].filter(Boolean).join(' ').slice(0, 300);
      failures.push(`${[...trail, spec.title].join(' › ')}${projects.length ? ` [${projects.join(', ')}]` : ''}${cause ? `: ${cause}` : ''}`);
    }
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title]);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return { stats: report.stats ?? null, failures };
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function buildNote({ passed, dns, summary, screenshotMarkdown }) {
  const lines = [];
  const verdict = passed ? 'PASS' : 'FAIL';
  lines.push(`**Production e2e: ${site}: ${verdict}** (hypervoid/admiral#123)`);
  lines.push('');
  lines.push(`- Site: ${baseUrl}`);
  lines.push(`- DNS from the CI pod: ${host} → ${dns.answers.length ? dns.answers.join(', ') : 'no answer'}`);
  if (summary.stats) {
    const s = summary.stats;
    lines.push(`- Tests: ${s.expected ?? 0} passed, ${s.unexpected ?? 0} failed, ${s.flaky ?? 0} flaky, ${s.skipped ?? 0} skipped`);
  } else if (summary.error) {
    lines.push(`- Tests: ${summary.error}`);
  }
  if (env.CI_PIPELINE_URL) lines.push(`- Pipeline: ${env.CI_PIPELINE_URL} (${env.CI_PIPELINE_SOURCE ?? 'unknown'} on ${env.CI_COMMIT_REF_NAME ?? '?'} @ ${env.CI_COMMIT_SHORT_SHA ?? '?'})`);
  if (env.CI_JOB_URL) lines.push(`- Job and artifacts (Playwright report, both viewports): ${env.CI_JOB_URL}/artifacts/browse`);
  if (!dns.ok) {
    lines.push('');
    lines.push(`Not run: ${dns.reason}.`);
  }
  if (summary.failures.length > 0) {
    lines.push('');
    lines.push('Failed:');
    for (const failure of summary.failures.slice(0, 15)) lines.push(`- ${failure}`);
    if (summary.failures.length > 15) lines.push(`- … and ${summary.failures.length - 15} more`);
  }
  if (!passed) {
    lines.push('');
    lines.push("**Red: this is the unit's first job** (hypervoid/admiral#123).");
  }
  lines.push('');
  lines.push(screenshotMarkdown ?? '_No landing-page screenshot was produced._');
  return `${lines.join('\n')}\n`;
}

async function gitlab(path, init, token) {
  const api = env.CI_API_V4_URL || 'https://git.developerdojo.org/api/v4';
  const response = await fetch(`${api}${path}`, { ...init, headers: { 'PRIVATE-TOKEN': token, ...(init.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${init.method ?? 'GET'} ${path} returned a body that is not JSON: ${text.slice(0, 200)}`);
  }
}

await mkdir(OUT_DIR, { recursive: true });
const dns = await preflight();
console.log(`production-e2e: ${host} resolves to ${dns.answers.join(', ') || 'nothing'} from this pod`);
let status;
if (dns.ok) {
  status = await run(command);
} else {
  console.error(`production-e2e: not running the suite: ${dns.reason}`);
  status = 4;
}
const summary = dns.ok ? await summarise() : { stats: null, failures: [] };
const passed = status === 0;
const haveScreenshot = await exists(screenshot);
const token = env[tokenName];

const artifactPath = relative(env.CI_PROJECT_DIR ?? process.cwd(), resolve(screenshot));
let screenshotMarkdown = haveScreenshot ? `Landing page as a customer sees it: \`${artifactPath}\` in the job artifacts.` : undefined;
let postStatus = 0;
await writeFile(NOTE, buildNote({ passed, dns, summary, screenshotMarkdown }));
if (token) {
  const project = encodeURIComponent(noteProject);
  try {
    if (haveScreenshot) {
      const form = new FormData();
      form.append('file', new Blob([await readFile(screenshot)], { type: 'image/png' }), `${host}-landing-${env.CI_PIPELINE_ID ?? 'local'}.png`);
      const upload = await gitlab(`/projects/${project}/uploads`, { method: 'POST', body: form }, token);
      screenshotMarkdown = `Landing page as a customer sees it (desktop, full page):\n\n${upload.markdown}`;
    }
    const body = buildNote({ passed, dns, summary, screenshotMarkdown });
    await writeFile(NOTE, body);
    const note = await gitlab(
      `/projects/${project}/issues/${noteIssue}/notes`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) },
      token,
    );
    console.log(`production-e2e: posted note ${note.id} on ${noteProject}#${noteIssue}`);
  } catch (error) {
    console.error(`production-e2e: posting the result to ${noteProject}#${noteIssue} failed: ${error.message}`);
    postStatus = 3;
  }
} else {
  console.log(`production-e2e: ${tokenName} is not set, so the result was not posted to ${noteProject}#${noteIssue}; it is in ${NOTE}.`);
}
console.log(`production-e2e: ${site} ${passed ? 'PASS' : 'FAIL'} (suite exit ${status})`);
process.exit(status !== 0 ? status : postStatus);
