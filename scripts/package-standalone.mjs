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

import { cp, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

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

console.log("✓ standalone bundle ready at .next/standalone/");
