#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const START = 'https://elportondelacondesa.com/';
const ORIGIN = new URL(START).origin;
const MAX_PAGES = Number(process.env.MAX_PAGES || 250);
const OUT = path.resolve(process.cwd(), 'project-reference/downloaded-assets');
const IMG_DIR = path.join(OUT, 'images');

await fs.mkdir(IMG_DIR, { recursive: true });

const queue = [START];
const visited = new Set();
const assets = new Map();

function cleanUrl(raw, base) {
  if (!raw) return null;
  try {
    const decoded = raw.replace(/&amp;/g, '&').trim();
    if (decoded.startsWith('data:') || decoded.startsWith('blob:') || decoded.startsWith('#')) return null;
    return new URL(decoded, base).href.split('#')[0];
  } catch { return null; }
}

function extract(html, pageUrl) {
  const links = new Set();
  const images = new Set();
  const hrefRe = /\bhref\s*=\s*["']([^"']+)["']/gi;
  const srcRe = /\b(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/gi;
  const srcsetRe = /\b(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi;
  const cssRe = /url\((?:["']?)([^)'"\s]+)(?:["']?)\)/gi;

  let m;
  while ((m = hrefRe.exec(html))) {
    const u = cleanUrl(m[1], pageUrl);
    if (u && new URL(u).origin === ORIGIN) links.add(u);
  }
  while ((m = srcRe.exec(html))) {
    const u = cleanUrl(m[1], pageUrl);
    if (u && u.includes('/wp-content/uploads/')) images.add(u);
  }
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      const u = cleanUrl(candidate, pageUrl);
      if (u && u.includes('/wp-content/uploads/')) images.add(u);
    }
  }
  while ((m = cssRe.exec(html))) {
    const u = cleanUrl(m[1], pageUrl);
    if (u && u.includes('/wp-content/uploads/')) images.add(u);
  }
  return { links, images };
}

function isPage(u) {
  try {
    const x = new URL(u);
    if (x.origin !== ORIGIN) return false;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|webm|mp3|css|js|xml)(?:\?|$)/i.test(x.pathname)) return false;
    if (x.pathname.startsWith('/wp-admin') || x.pathname.startsWith('/wp-login')) return false;
    return true;
  } catch { return false; }
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PortonAssetCollector/1.0' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const type = r.headers.get('content-type') || '';
  if (!type.includes('text/html')) return '';
  return await r.text();
}

console.log(`Crawling ${START}`);
while (queue.length && visited.size < MAX_PAGES) {
  const url = queue.shift();
  if (!url || visited.has(url) || !isPage(url)) continue;
  visited.add(url);
  try {
    const html = await fetchText(url);
    const { links, images } = extract(html, url);
    for (const img of images) assets.set(img, assets.get(img) || new Set());
    for (const img of images) assets.get(img).add(url);
    for (const link of links) if (!visited.has(link) && isPage(link)) queue.push(link);
    console.log(`[${visited.size}] ${url} -> ${images.size} imágenes`);
  } catch (e) {
    console.warn(`WARN ${url}: ${e.message}`);
  }
}

const manifest = [];
let n = 0;
for (const [url, sourcePages] of assets.entries()) {
  n++;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PortonAssetCollector/1.0' }, redirect: 'follow' });
    if (!r.ok) throw new Error(`${r.status}`);
    const buffer = Buffer.from(await r.arrayBuffer());
    const extFromUrl = path.extname(new URL(url).pathname).toLowerCase();
    const ext = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(extFromUrl) ? extFromUrl : '.bin';
    const base = path.basename(new URL(url).pathname, extFromUrl).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'asset';
    const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
    const filename = `${String(n).padStart(4, '0')}-${base}-${hash}${ext}`;
    await fs.writeFile(path.join(IMG_DIR, filename), buffer);
    manifest.push({ filename, url, sourcePages: [...sourcePages], bytes: buffer.length });
    console.log(`IMG ${n}/${assets.size}: ${filename}`);
  } catch (e) {
    manifest.push({ filename: null, url, sourcePages: [...sourcePages], error: e.message });
    console.warn(`WARN IMG ${url}: ${e.message}`);
  }
}

await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ crawledPages: [...visited], assets: manifest }, null, 2), 'utf8');
console.log(`\nFinalizado: ${visited.size} páginas, ${assets.size} URLs de imagen detectadas.`);
console.log(`Salida: ${OUT}`);
