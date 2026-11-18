#!/usr/bin/env node
// Brings every page listed in sitemap.xml up to one standard, repeatably:
//   search and sharing  a page-specific <title>, a canonical link, Open Graph and
//                       Twitter card tags, schema.org JSON-LD
//   accessibility       one <h1>, a "Skip to content" link, a <main> landmark,
//                       an alt attribute on every image
//   safety and speed    rel="noopener" on links that open a new tab (the referrer is
//                       kept, so our sister sites still see where visitors came from),
//                       async image decoding, lazy loading of sized images below the top of the page
// Idempotent: a second run changes nothing. `--check` (CI) changes nothing and
// fails when a page would change, so a new or edited page cannot ship without it.
// Usage: node scripts/strengthen-pages.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGIN = 'https://ignitecuriosity.org';
const SITE = 'Ignite Curiosity';
const SHARE_IMAGE = { path: '/images/1920/keystype.jpg', width: 1920, height: 900, alt: 'A learner at a keyboard exploring digital learning' };
const META_START = '<!-- site-meta:start (scripts/strengthen-pages.mjs) -->';
const META_END = '<!-- site-meta:end -->';
const SKIP_LINK = '<a class="skip-link" href="#main-content">Skip to content</a>';
// <main> is display:contents so that wrapping the page body in it cannot move a single
// pixel (the banner's percentage height depends on being a child of <body>); the skip
// link lands on an out-of-flow target at the top of it.
const SKIP_TARGET = '<span id="main-content" class="skip-target" tabindex="-1"></span>';
const SKIP_STYLE = '<style>.skip-link{position:absolute;left:-9999px;top:0;z-index:100000;padding:12px 18px;background:#fff;color:#111;font-weight:700}.skip-link:focus{left:0}main{display:contents}.skip-target{position:absolute}</style>';
const EAGER_IMAGES = 3; // the logo and the first banner images stay eager

const check = process.argv.includes('--check');

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`ERROR: cannot read ${path}: ${err.message}`);
    process.exit(2);
  }
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function pagesFromSitemap() {
  const xml = read('sitemap.xml');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const url = m[1];
    const rel = url.slice(ORIGIN.length + 1);
    const file = rel === '' ? 'index.html' : rel.endsWith('/') ? rel + 'index.html' : rel;
    return { url, file };
  });
}

// The heading shown in the page banner, e.g. <div class="title-page">Careers</div>.
function bannerHeading(src) {
  const m = src.match(/<(div|h1)\b[^>]*class="[^"]*\btitle-page\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i);
  return m ? plain(m[2]) : '';
}

function fixTitle(src) {
  const m = src.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return src;
  const heading = bannerHeading(src);
  if (plain(m[1]) !== SITE || !heading || heading === SITE) return src;
  return src.replace(m[0], `<title>${attr(heading)} | ${SITE}</title>`);
}

// A page with no <h1> gets its banner heading as the h1 (same class, same look).
function fixH1(src) {
  if (/<h1[\s>]/i.test(src)) return src;
  return src.replace(/<div(\b[^>]*class="[^"]*\btitle-page\b[^"]*"[^>]*)>([\s\S]*?)<\/div>/i, (all, attrs, inner) =>
    /<div\b/i.test(inner) ? all : `<h1${attrs}>${inner}</h1>`);
}

function metaBlock(src, page) {
  const title = plain(src.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? SITE);
  const description = decode(src.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '').trim();
  const isHome = page.file === 'index.html';
  const org = {
    '@type': 'Organization',
    '@id': `${ORIGIN}/#organization`,
    name: SITE,
    url: `${ORIGIN}/`,
    logo: `${ORIGIN}/images/logo.svg`,
    parentOrganization: { '@type': 'Organization', name: 'Curiosity Research Corporation', url: 'https://curiositycorp.org' },
  };
  const site = { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: SITE, url: `${ORIGIN}/`, publisher: { '@id': org['@id'] } };
  const webPage = { '@type': 'WebPage', '@id': `${page.url}#webpage`, url: page.url, name: title, isPartOf: { '@id': site['@id'] } };
  if (description) webPage.description = description;
  const graph = isHome ? [org, site, webPage] : [webPage, site, org];
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  const lines = [
    META_START,
    `<link rel="canonical" href="${page.url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:title" content="${attr(title)}">`,
    description ? `<meta property="og:description" content="${attr(description)}">` : null,
    `<meta property="og:url" content="${page.url}">`,
    `<meta property="og:image" content="${ORIGIN}${SHARE_IMAGE.path}">`,
    `<meta property="og:image:width" content="${SHARE_IMAGE.width}">`,
    `<meta property="og:image:height" content="${SHARE_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${attr(SHARE_IMAGE.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="referrer" content="strict-origin-when-cross-origin">`,
    `<script type="application/ld+json">${jsonLd}</script>`,
    SKIP_STYLE,
    META_END,
  ].filter(Boolean);
  return lines.join('\n');
}

function fixMeta(src, page) {
  const block = metaBlock(src, page);
  const start = src.indexOf(META_START);
  if (start !== -1) {
    const end = src.indexOf(META_END, start);
    if (end === -1) throw new Error(`${page.file}: "${META_START}" has no "${META_END}"`);
    return src.slice(0, start) + block + src.slice(end + META_END.length);
  }
  if (!/<\/head>/i.test(src)) throw new Error(`${page.file}: no </head>`);
  return src.replace(/<\/head>/i, `${block}\n</head>`);
}

// <main> runs from the banner (or the content) to the footer.
// Only when the <div>s between the two markers are balanced, so the wrapper
// cannot cut across the page's own structure.
function fixMain(src, page, notes) {
  let out = src;
  if (!out.includes(SKIP_LINK)) out = out.replace(/<body\b[^>]*>/i, (m) => `${m}\n${SKIP_LINK}`);
  if (/<main\b/i.test(out)) return out;
  const open = out.search(/[ \t]*<!-- (BANNER|CONTENT)\b[^>]*-->/);
  const close = out.search(/[ \t]*<!-- FOOTER SECTION -->/);
  if (open === -1 || close === -1 || close < open) {
    notes.push(`${page.file}: no BANNER/CONTENT and FOOTER SECTION markers; no <main> added`);
    return out.includes(SKIP_TARGET) ? out : out.replace(SKIP_LINK, `${SKIP_LINK}\n${SKIP_TARGET}`);
  }
  const between = out.slice(open, close).replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const balance = (between.match(/<div\b/gi) ?? []).length - (between.match(/<\/div>/gi) ?? []).length;
  if (balance !== 0) {
    notes.push(`${page.file}: <div>s between banner and footer are unbalanced by ${balance}; no <main> added`);
    return out.includes(SKIP_TARGET) ? out : out.replace(SKIP_LINK, `${SKIP_LINK}\n${SKIP_TARGET}`);
  }
  return `${out.slice(0, open)}<main>\n${SKIP_TARGET}\n${out.slice(open, close)}</main>\n${out.slice(close)}`;
}

function fixLinksAndImages(src) {
  let out = src.replace(/<a\b[^>]*\btarget="_blank"[^>]*>/gi, (tag) => {
    const rel = tag.match(/\brel="([^"]*)"/i);
    if (!rel) return tag.replace(/\btarget="_blank"/i, 'target="_blank" rel="noopener"');
    const words = rel[1].split(/\s+/).filter(Boolean);
    if (words.includes('noopener') || words.includes('noreferrer')) return tag;
    return tag.replace(rel[0], `rel="${[...words, 'noopener'].join(' ')}"`);
  });
  let seen = 0;
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    seen++;
    let t = tag;
    const add = (text) => { t = t.replace(/\s*\/?>$/, (end) => ` ${text}${end.includes('/') ? ' />' : '>'}`); };
    if (!/\balt\s*=/i.test(t)) add('alt=""');
    if (!/\bdecoding\s*=/i.test(t)) add('decoding="async"');
    // Lazy only when the image states its size: without it the page would jump as images arrive.
    const sized = /\bwidth\s*=/i.test(t) && /\bheight\s*=/i.test(t);
    if (seen > EAGER_IMAGES && sized && !/\bloading\s*=/i.test(t)) add('loading="lazy"');
    return t;
  });
  return out;
}

const notes = [];
let changed = 0;
const pages = pagesFromSitemap();
for (const page of pages) {
  const before = read(page.file);
  let after = before;
  try {
    after = fixTitle(after);
    after = fixH1(after);
    after = fixLinksAndImages(after);
    after = fixMain(after, page, notes);
    after = fixMeta(after, page);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }
  if (after === before) continue;
  changed++;
  if (check) console.error(`would change: ${page.file}`);
  else {
    try {
      writeFileSync(page.file, after);
    } catch (err) {
      console.error(`ERROR: cannot write ${page.file}: ${err.message}`);
      process.exit(2);
    }
  }
}
for (const n of notes) console.log(`note: ${n}`);
if (check && changed) {
  console.error(`ERROR: ${changed} of ${pages.length} page(s) are not at the site standard; run node scripts/strengthen-pages.mjs`);
  process.exit(1);
}
console.log(`${check ? 'OK' : 'done'}: ${pages.length} pages, ${changed} ${check ? 'would change' : 'changed'}`);
