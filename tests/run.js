// Node ile çalıştırma: node tests/run.js
import { runTests } from './schedule.test.js';

const results = runTests();
let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`✓ ${r.name}`);
  else {
    failed++;
    console.log(`✗ ${r.name}\n    ${r.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} test geçti`);
process.exitCode = failed ? 1 : 0;
