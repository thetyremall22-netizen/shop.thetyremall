// Assemble the deployable standalone bundle after `next build`.
//
// Next's standalone output (.next/standalone/server.js + a traced node_modules)
// does NOT include the static assets, so we copy them in:
//   public/        -> .next/standalone/public
//   .next/static/  -> .next/standalone/.next/static
//
// After this runs, the ENTIRE contents of .next/standalone/ is the app to ship
// to the server (server.js is the Passenger startup file). No `npm install`
// needed on the server — deps are already traced into node_modules.

import { cp, access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

// Nginx Unit's node http shim (unit-http) ships an incomplete ServerResponse —
// it lacks appendHeader()/setHeaders(), which Next's PAGE renderer calls, so
// every page 500s under Unit while API routes work. Polyfill them at the very
// top of server.js so the app runs unchanged on Unit (no-op on normal Node).
const UNIT_POLYFILL = `/* TTM-UNIT-POLYFILL: add appendHeader/setHeaders for Nginx Unit's http shim */
(function(){try{var http=require('http');var proto=http&&http.ServerResponse&&http.ServerResponse.prototype;if(proto&&typeof proto.appendHeader!=='function'){proto.appendHeader=function(n,v){var p=this.getHeader(n);if(p===undefined)return this.setHeader(n,v);var a=Array.isArray(p)?p.slice():[String(p)];if(Array.isArray(v)){for(var i=0;i<v.length;i++)a.push(v[i]);}else{a.push(v);}return this.setHeader(n,a);};}if(proto&&typeof proto.setHeaders!=='function'){proto.setHeaders=function(h){var s=this;if(h&&typeof h.forEach==='function'){h.forEach(function(v,k){s.setHeader(k,v);});}else if(h){Object.keys(h).forEach(function(k){s.setHeader(k,h[k]);});}return this;};}}catch(e){}})();
`;

if (!(await exists(standalone))) {
  console.error("✗ .next/standalone not found — run `next build` with output:'standalone' first.");
  process.exit(1);
}

// public/  ->  .next/standalone/public
if (await exists(path.join(root, "public"))) {
  await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
  console.log("✓ copied public/ -> .next/standalone/public");
}

// .next/static  ->  .next/standalone/.next/static
if (await exists(path.join(root, ".next", "static"))) {
  await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
  console.log("✓ copied .next/static -> .next/standalone/.next/static");
}

// Inject the Nginx Unit polyfill at the top of server.js (idempotent).
const serverJs = path.join(standalone, "server.js");
if (await exists(serverJs)) {
  let src = await readFile(serverJs, "utf8");
  if (!src.includes("TTM-UNIT-POLYFILL")) {
    await writeFile(serverJs, UNIT_POLYFILL + src);
    console.log("✓ injected Nginx Unit appendHeader/setHeaders polyfill into server.js");
  }
}

console.log("✓ standalone bundle ready at .next/standalone/");
