#!/usr/bin/env node
// Appended to sw.js after every next build so push handlers survive Workbox regeneration.
// With `output: 'export'` the served copy is out/sw.js, so patch it as well as public/sw.js.
const fs = require('fs');
const path = require('path');

const handler = path.join(__dirname, '../public/push-handler.js');
const targets = ['../public/sw.js', '../out/sw.js'].map((p) => path.join(__dirname, p));

if (!fs.existsSync(handler)) { console.error('[push] push-handler.js not found — skipping'); process.exit(0); }
const handlerContent = '\n// push-handler-appended\n' + fs.readFileSync(handler, 'utf8');

for (const sw of targets) {
  if (!fs.existsSync(sw)) { console.log(`[push] ${path.relative(process.cwd(), sw)} not found — skipping`); continue; }
  if (fs.readFileSync(sw, 'utf8').includes('push-handler-appended')) {
    console.log(`[push] ${path.relative(process.cwd(), sw)} already has the push handler — skipping`);
    continue;
  }
  fs.appendFileSync(sw, handlerContent);
  console.log(`[push] push-handler.js appended to ${path.relative(process.cwd(), sw)}`);
}
