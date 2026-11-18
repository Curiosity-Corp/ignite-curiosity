#!/usr/bin/env node
// Fails when register.html or contact.html has no form, or the form posts to an
// address that is not https or whose host has no DNS record. A page with a
// notice instead of a form, or a form aimed at a host that does not exist,
// takes no registrations and no messages (Curiosity-Corp/ignite-curiosity#20).
import { readFileSync, existsSync } from 'node:fs';
import { lookup } from 'node:dns/promises';

const FORMS = [
  { page: 'register.html', id: 'registerForm', needs: ['js/custom.register.validate.js', 'js/jquery.validate.js'] },
  { page: 'contact.html', id: 'contactForm', needs: ['js/custom.contact.validate.js'] },
];

const errors = [];
for (const { page, id, needs } of FORMS) {
  let src;
  try {
    src = readFileSync(page, 'utf8');
  } catch (err) {
    errors.push(`${page}: cannot read (${err.message})`);
    continue;
  }
  const tag = src.match(/<form\b[^>]*>/gi)?.find((t) => new RegExp(`\\bid="${id}"`).test(t));
  if (!tag) {
    errors.push(`${page}: no <form id="${id}">; the page cannot take a submission`);
    continue;
  }
  const action = tag.match(/\baction="([^"]*)"/i)?.[1] ?? '';
  let url;
  try {
    url = new URL(action);
  } catch {
    errors.push(`${page}: form action "${action}" is not an absolute URL`);
    continue;
  }
  if (url.protocol !== 'https:') errors.push(`${page}: form action ${action} is not https`);
  try {
    await lookup(url.hostname);
  } catch (err) {
    errors.push(`${page}: form posts to ${url.hostname}, which does not resolve (${err.code ?? err.message})`);
  }
  for (const file of needs) {
    if (!existsSync(file)) errors.push(`${page}: ${file} is missing, so the form cannot submit`);
    else if (!src.includes(file)) errors.push(`${page}: does not load ${file}`);
  }
  console.log(`${page}: form #${id} posts to ${action}`);
}

if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log('OK: the register and contact forms post to resolvable https addresses');
