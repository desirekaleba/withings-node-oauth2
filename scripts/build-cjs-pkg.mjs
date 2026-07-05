// After the CommonJS build, mark dist/cjs as a CommonJS package so Node treats
// its .js files as CJS while the ESM output at dist/ stays ESM ("type": "module"
// at the project root). Cross-platform; no shell dependencies.
import { writeFileSync } from "node:fs";

const target = new URL("../dist/cjs/package.json", import.meta.url);
writeFileSync(target, JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
