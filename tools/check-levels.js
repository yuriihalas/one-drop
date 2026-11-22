// Checks every level against the physics that ships in index.html.
// Run: node tools/check-levels.js   (levels are checked in parallel, one process each)
// For each level it drops at the hint spot (must win with a margin) and on a
// grid of other spots, every third cell (the winning share must stay inside sane bounds,
// so no level is either impossible or won from anywhere).
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.split('//CORE>')[1].split('//<CORE')[0];
const levelsSrc = 'const LEVELS=' + html.split('const LEVELS=')[1].split('}];')[0] + '}];';
const ctx = { Math, Float32Array, Uint8Array };
vm.createContext(ctx);
vm.runInContext(core + '\n' + levelsSrc +
  '\nthis.api={buildLevel,simReset,simDrop,simTick,canDrop,judge,get MX(){return MX},N,STEPS,LEVELS};', ctx);
const A = ctx.api;
const run = (x, y) => { A.simReset(); A.simDrop(x, y); for (let s = 0; s < A.STEPS; s++) A.simTick(); return Math.min(...A.MX); };
// Melody levels are judged by the order and rhythm of arrivals, not by height:
// 2 means right order with exact rhythm, 1 means the melody is accepted, 0 means it is not.
const runTune = (x, y) => { run(x, y); const j = A.judge(); return j.ok ? (j.err <= 7 ? 2 : 1) : 0; };
const checkLevel = (L, i) => {
  A.buildLevel(L);
  const problems = [];
  if (!A.canDrop(L.best[0], L.best[1])) problems.push('hint spot is not a legal drop');
  const ratio = L.tune ? runTune(L.best[0], L.best[1]) : run(L.best[0], L.best[1]) / L.T;
  if (L.tune ? ratio < 2 : ratio < 1.1) problems.push(L.tune ? 'hint spot does not play the melody in exact rhythm' : 'hint spot wins by less than 10%');
  if (Math.hypot(L.best[0] - L.hint[0], L.best[1] - L.hint[1]) > L.hint[2]) problems.push('hint spot lies outside the hint circle');
  let all = 0, wins = 0;
  for (let y = 2; y < A.N - 1; y += 3) for (let x = 2; x < A.N - 1; x += 3) {
    if (!A.canDrop(x, y)) continue; all++; if (L.tune ? runTune(x, y) > 0 : run(x, y) >= L.T) wins++;
  }
  const share = wins / all, lo = 0.02, hi = i === 0 ? 0.8 : 0.45;
  if (share < lo || share > hi) problems.push('winning share out of bounds');
  return { failed: problems.length > 0, line: `${problems.length ? 'FAIL' : 'ok  '} ${i + 1}. ${L.name}: hint ${L.tune ? 'plays in exact rhythm' : ratio.toFixed(2) + 'x'}, wins ${(share * 100).toFixed(1)}% of ${all} spots${problems.length ? ' -- ' + problems.join('; ') : ''}` };
};
if (process.argv[2] !== undefined) {
  const i = +process.argv[2];
  process.stdout.write(JSON.stringify(checkLevel(A.LEVELS[i], i)));
} else {
  const { execFile } = require('child_process'), os = require('os');
  const n = A.LEVELS.length, results = new Array(n);
  let next = 0, running = 0, done = 0;
  const finish = () => {
    let failed = 0;
    results.forEach(r => { console.log(r.line); if (r.failed) failed++; });
    if (failed) { console.error(failed + ' level(s) failed'); process.exit(1); }
    console.log('all ' + n + ' levels pass');
  };
  const pump = () => {
    while (running < Math.max(1, os.cpus().length - 1) && next < n) {
      const i = next++; running++;
      execFile(process.execPath, [__filename, String(i)], { maxBuffer: 1e7 }, (err, out) => {
        results[i] = err ? { failed: true, line: `FAIL ${i + 1}. could not run: ${err.message}` } : JSON.parse(out);
        running--; done++;
        if (done === n) finish(); else pump();
      });
    }
  };
  pump();
}
