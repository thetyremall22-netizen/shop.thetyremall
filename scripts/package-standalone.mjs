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

// Startup shim prepended to the built server.js for the Nginx Unit deploy:
//  1) loads app/.env — the DirectAdmin env form rejects values with dots / @ / :
//     (SMTP host, email addresses, URLs), so secrets like SMTP creds go in a
//     plain .env file next to server.js instead;
//  2) polyfills ServerResponse.appendHeader()/setHeaders(), which Unit's node
//     http shim (unit-http) lacks and Next's page renderer calls (else every
//     page 500s on Unit while API routes work);
//  3) mirrors console.error to app/error.log (the server has no accessible log).
// All no-ops on normal Node, so the same bundle runs anywhere.
const UNIT_POLYFILL = `/* TTM-UNIT-PATCH: load app/.env + appendHeader/setHeaders polyfill + error log (Nginx Unit) */
(function(){
  var fs,path; try{fs=require('fs');path=require('path');}catch(e){return;}
  try{var ep=path.join(__dirname,'.env'); if(fs.existsSync(ep)){ fs.readFileSync(ep,'utf8').split(/\\r?\\n/).forEach(function(l){ l=l.trim(); if(!l||l.charAt(0)==='#')return; var i=l.indexOf('='); if(i<0)return; var k=l.slice(0,i).trim(); var v=l.slice(i+1).trim(); if(v.length>1&&((v.charAt(0)==='"'&&v.charAt(v.length-1)==='"')||(v.charAt(0)==="'"&&v.charAt(v.length-1)==="'")))v=v.slice(1,-1); if(k&&process.env[k]===undefined)process.env[k]=v; }); } }catch(e){}
  try{var http=require('http');var pr=http&&http.ServerResponse&&http.ServerResponse.prototype; if(pr&&typeof pr.appendHeader!=='function'){pr.appendHeader=function(n,val){var p=this.getHeader(n);if(p===undefined)return this.setHeader(n,val);var a=Array.isArray(p)?p.slice():[String(p)];if(Array.isArray(val)){for(var i=0;i<val.length;i++)a.push(val[i]);}else{a.push(val);}return this.setHeader(n,a);};} if(pr&&typeof pr.setHeaders!=='function'){pr.setHeaders=function(h){var s=this;if(h&&typeof h.forEach==='function'){h.forEach(function(v,k){s.setHeader(k,v);});}else if(h){Object.keys(h).forEach(function(k){s.setHeader(k,h[k]);});}return this;};} }catch(e){}
  try{var lf=path.join(__dirname,'error.log');var w=function(s){try{fs.appendFileSync(lf,s+'\\n');}catch(e){}};var o=console.error.bind(console);console.error=function(){var a=Array.prototype.slice.call(arguments);w(a.map(function(x){return (x&&x.stack)||String(x);}).join(' '));o.apply(null,a);};process.on('uncaughtException',function(e){w('UNCAUGHT: '+((e&&e.stack)||e));});process.on('unhandledRejection',function(e){w('REJECT: '+((e&&e.stack)||e));});w('--- TTM start '+new Date().toISOString()+' node '+process.version+' ---');}catch(e){}
})();
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

// Inject the Nginx Unit startup shim at the top of server.js (idempotent).
const serverJs = path.join(standalone, "server.js");
if (await exists(serverJs)) {
  let src = await readFile(serverJs, "utf8");
  if (!src.includes("TTM-UNIT-PATCH")) {
    await writeFile(serverJs, UNIT_POLYFILL + src);
    console.log("✓ injected Nginx Unit startup shim (.env loader + appendHeader polyfill + error log) into server.js");
  }
}

console.log("✓ standalone bundle ready at .next/standalone/");
