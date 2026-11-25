// Syntax-lints every plugin PHP file using php-parser (no PHP runtime needed).
// Usage: node test/php-lint.mjs
import { Engine } from 'php-parser';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = 'plugin/agent-ready-shop';
const parser = new Engine({ parser: { suppressErrors: false }, ast: { withPositions: true } });

function walk(dir) {
  let files = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files = files.concat(walk(p));
    else if (p.endsWith('.php')) files.push(p);
  }
  return files;
}

let errors = 0;
for (const file of walk(ROOT)) {
  try {
    const ast = parser.parseCode(readFileSync(file, 'utf8'), file);
    const errs = (ast.errors || []);
    if (errs.length) {
      errors += errs.length;
      console.log(`✗ ${file}`);
      for (const e of errs) console.log(`    ${e.message}`);
    } else {
      console.log(`✓ ${file}`);
    }
  } catch (e) {
    errors++;
    console.log(`✗ ${file}\n    ${e.message}`);
  }
}
console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'} — ${errors} syntax error(s)`);
process.exit(errors === 0 ? 0 : 1);
