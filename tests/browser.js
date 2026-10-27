import { runTests as schedule } from './schedule.test.js';
import { runTests as ics } from './ics.test.js';

const results = [...schedule(), ...ics()];
const list = document.getElementById('results');
let failed = 0;
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'ok' : 'fail';
  li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name;
  if (!r.ok) {
    failed++;
    const pre = document.createElement('pre');
    pre.textContent = r.error;
    li.append(pre);
  }
  list.append(li);
}
const summary = document.getElementById('summary');
summary.textContent = `${results.length - failed}/${results.length} test geçti · saat dilimi: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
summary.className = failed ? 'fail' : 'ok';
