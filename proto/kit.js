// Shared shell for the element prototypes: one square canvas, level buttons,
// a card with the rule, one tap per try. Each prototype passes an object:
//   G        grid size (cells per side)
//   levels   [{name, text, ...}]
//   build(L) set up a level
//   tap(x,y) one touch at a cell; return false to refuse it (and say why via P.say)
//   step()   advance the simulation once
//   speed    steps per frame
//   verdict() 0 still running, 1 won, -1 lost
//   failText() why it was lost
//   draw(g, K, now) paint everything; K is pixels per cell
//   slowmo   if set, a win is replayed once at this fraction of normal speed, framed like a slow-motion shot;
//            P.state is 'replay' while it plays and P.slow is the replay's progress clock in seconds
function Proto(P) {
  const $ = id => document.getElementById(id);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="wrap"><div id="top"><a href="index.html">← Стихії</a><b id="lvname"></b><span id="lvs"></span></div>' +
    '<div id="stage"><canvas id="cv"></canvas><div id="card"><div><small id="cnum"></small><h2 id="cname"></h2><p id="ctext"></p><button class="go" id="cgo">Почати</button></div></div></div>' +
    '<div id="bar"><div id="msg"></div><button id="replay">Повтор</button><button id="hint">Підказка</button><button id="again">Ще раз</button><button id="next" class="go">Далі</button></div>' +
    '<div id="sub">Прототип. Один дотик на спробу. Після трьох невдалих спроб з’явиться підказка.</div></div>');
  const cv = $('cv'), g = cv.getContext('2d'), stage = $('stage');
  let size = 600, lv = 0, state = 'card', tries = 0, hintOn = false, lastTap = null, acc = 0, replayAt = 0, repStart = 0;
  P.say = t => { $('msg').textContent = t; };
  function resize() {
    const css = Math.max(240, Math.min(innerWidth - 24, innerHeight - (innerWidth < 600 ? 250 : 190), 760)), dpr = Math.min(devicePixelRatio || 1, 2);
    stage.style.width = stage.style.height = css + 'px'; size = Math.round(css * dpr); cv.width = cv.height = size;
  }
  addEventListener('resize', resize); resize();
  P.levels.forEach((L, k) => { const b = document.createElement('button'); b.className = 'lv'; b.textContent = k + 1; b.title = L.name; b.onclick = () => setLevel(k); $('lvs').appendChild(b); });
  function setLevel(i) {
    lv = i; tries = 0; hintOn = false; replayAt = 0; $('hint').style.display = 'none'; $('replay').style.display = 'none'; const L = P.levels[i]; P.L = L; P.build(L);
    document.querySelectorAll('.lv').forEach((b, k) => b.classList.toggle('cur', k === i));
    $('lvname').textContent = (i + 1) + '. ' + L.name; $('cnum').textContent = 'РІВЕНЬ ' + (i + 1) + ' З ' + P.levels.length;
    $('cname').textContent = L.name; $('ctext').textContent = L.text; $('card').classList.add('on'); $('next').style.display = 'none'; state = 'card'; P.say('');
  }
  function begin() { if (state !== 'card') return; $('card').classList.remove('on'); state = 'idle'; P.say(P.idleText || 'Торкніться поля.'); }
  function reset() { if (state === 'card') return; P.build(P.L); state = 'idle'; replayAt = 0; $('next').style.display = 'none'; $('replay').style.display = 'none'; P.say(P.idleText || 'Торкніться поля.'); }
  function finish(v) {
    if (state === 'replay') { state = 'win'; return; }
    state = v > 0 ? 'win' : 'lost';
    if (v > 0) { $('hint').style.display = 'none'; if (P.slowmo && state !== 'replay') { $('replay').style.display = 'inline-block'; replayAt = performance.now() + 900; } P.say((P.winText ? P.winText() : 'Вийшло.') + (tries === 1 ? ' З першої спроби.' : ' Спроба № ' + tries + '.')); $('next').style.display = 'inline-block'; $('next').textContent = lv < P.levels.length - 1 ? 'Далі' : 'З початку'; }
    else { P.say(P.failText() + ' Торкніться поля, щоб спробувати ще раз.'); if (tries >= 3 && P.L.best && !hintOn) $('hint').style.display = 'inline-block'; }
  }
  function cell(e) { const r = stage.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * P.G), Math.floor((e.clientY - r.top) / r.height * P.G)]; }
  P.hover = null;
  stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') P.hover = cell(e); });
  stage.addEventListener('pointerleave', () => { P.hover = null; });
  stage.addEventListener('pointerup', e => {
    if (e.target.closest('#card')) return;
    if (state === 'lost') { reset(); return; } if (state === 'replay') return;
    if (state !== 'idle') return;
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= P.G || y >= P.G) return;
    if (P.tap(x, y) === false) return; lastTap = [x, y]; tries++; state = 'run';
  });
  // the slow-motion replay: rebuild, touch the same cell, and step at a fraction of the speed
  function replay() { if (!lastTap || state === 'run' || state === 'card') return; replayAt = 0; P.build(P.L); P.tap(lastTap[0], lastTap[1]); P.say('Повтор, уповільнено.'); state = 'replay'; acc = 0; repStart = performance.now(); }
  function skipReplay() { let n = 0; while (state === 'replay' && n++ < 200000) { P.step(); if (P.verdict()) finish(1); } P.say((P.winText ? P.winText() : 'Вийшло.')); }
  $('replay').onclick = replay;
  stage.addEventListener('pointerdown', e => { if (state === 'replay' && !e.target.closest('#card')) skipReplay(); });
  $('hint').onclick = () => { hintOn = true; $('hint').style.display = 'none'; reset(); P.say('Спробуйте там, де пульсує коло.'); };
  $('again').onclick = reset; $('cgo').onclick = begin; $('next').onclick = () => setLevel(lv < P.levels.length - 1 ? lv + 1 : 0);
  addEventListener('keydown', e => { if (e.repeat) return; if (state === 'card' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); begin(); } else if (e.code === 'KeyR') reset(); else if (e.code === 'KeyN' && state === 'win') $('next').onclick(); });
  function frame(now) {
    if (state === 'run') { for (let k = 0; k < (P.speed || 1) && state === 'run'; k++) { P.step(); const v = P.verdict(); if (v) finish(v); } }
    else if (state === 'replay') { acc += (P.speed || 1) * P.slowmo; P.slow = (now - repStart) / 1000; while (acc >= 1 && state === 'replay') { acc--; P.step(); if (P.verdict()) finish(1); } if (state === 'win') P.say(P.winText ? P.winText() : 'Вийшло.'); }
    else if (state === 'win' && replayAt && now > replayAt) replay();
    else if ((state === 'win' || state === 'lost') && P.after) P.after();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, size, size); P.state = state; P.draw(g, size / P.G, now, size);
    if (state === 'replay') { // the slow-motion frame: letterbox bars, a soft vignette and a label
      const u = size / 600, bar = Math.min(1, (now - repStart) / 400) * 20 * u; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
      const vg = g.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, size, size);
      g.fillStyle = '#000'; g.fillRect(0, 0, size, bar); g.fillRect(0, size - bar, size, bar);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 ' + Math.round(12 * u) + 'px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('ПОВТОР  ×' + (Number.isInteger(1 / P.slowmo) ? '1/' + (1 / P.slowmo) : String(P.slowmo).replace('.', ',')), 16 * u, bar / 2);
      if ((now / 500 | 0) % 2) { g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(size - 22 * u, bar / 2, 5 * u, 0, 7); g.fill(); }
      g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('дотик пропускає', size - 34 * u, bar / 2); g.restore(); }
    if (hintOn && state === 'idle') { // the hint: a slow pulsing ring on a spot that is known to win
      const K = size / P.G, b = P.L.best, ph = now / 900 % 1; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
      g.lineWidth = Math.max(2, K * 0.35); g.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - ph)) + ')'; g.beginPath(); g.arc((b[0] + 0.5) * K, (b[1] + 0.5) * K, (1.5 + ph * 4) * K, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,214,120,.95)'; g.beginPath(); g.arc((b[0] + 0.5) * K, (b[1] + 0.5) * K, 1.5 * K, 0, 7); g.stroke(); g.restore(); }
    requestAnimationFrame(frame);
  }
  // Test hook: jump to a level, tap a cell, run to the end without drawing.
  window.__p = {
    level: i => { setLevel(i); begin(); },
    tap: (x, y) => { reset(); if (P.tap(x, y) === false) return 'refused'; lastTap = [x, y]; tries++; state = 'run'; let n = 0; while (state === 'run' && n++ < 200000) { P.step(); const v = P.verdict(); if (v) finish(v); } return state; },
    state: () => state, P, hint: () => hintOn, replay, skipReplay
  };
  setLevel(0); requestAnimationFrame(frame);
}
// Small helpers shared by the prototypes.
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function emoji(g, ch, x, y, px) { g.font = Math.round(px) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y); }
// Drawn objects shared by the prototypes. Each takes the canvas context, a position in pixels and s, the size of
// one grid cell in pixels, so the same hut or tree sits right at any canvas size.
const Art = {
  h(i) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; },
  // A cottage seen from the side. (x, y) is the middle of its base; o.w, o.h, o.r are wall width, wall height and roof height.
  house(g, x, y, s, o = {}) { const w = o.w || 8.4 * s, h = o.h || 5 * s, r = o.r || 4.6 * s, b = o.burnt, L = x - w / 2, T = y - h;
    g.save(); g.lineJoin = 'round'; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y, w * 0.62, s * 0.5, 0, 0, 7); g.fill();
    g.fillStyle = b ? '#2b2420' : '#6b4a3a'; g.fillRect(x + w * 0.2, T - r * 0.82, w * 0.13, r * 0.6); g.fillStyle = b ? '#1c1815' : '#4a332a'; g.fillRect(x + w * 0.18, T - r * 0.86, w * 0.17, r * 0.09);
    const wg = g.createLinearGradient(L, 0, L + w, 0); wg.addColorStop(0, b ? '#4a3a30' : '#efe3c8'); wg.addColorStop(1, b ? '#2e2420' : '#c9b48c'); g.fillStyle = wg; g.fillRect(L, T, w, h);
    g.strokeStyle = b ? '#1d1613' : '#5a3d28'; g.lineWidth = Math.max(1, w * 0.028); g.beginPath(); for (const fx of [0, 0.36, 0.64, 1]) { g.moveTo(L + w * fx, T); g.lineTo(L + w * fx, y); } g.moveTo(L, T + h * 0.5); g.lineTo(L + w * 0.36, T + h * 0.5); g.moveTo(L + w * 0.64, T + h * 0.5); g.lineTo(L + w, T + h * 0.5); g.moveTo(L, y); g.lineTo(L + w * 0.36, T + h * 0.5); g.moveTo(L + w, y); g.lineTo(L + w * 0.64, T + h * 0.5); g.stroke();
    g.fillStyle = b ? '#3a3632' : '#8a8a86'; g.fillRect(L - w * 0.02, y - h * 0.13, w * 1.04, h * 0.13); g.strokeStyle = 'rgba(30,30,30,.45)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 7; k++) { g.moveTo(L + w * k / 7, y - h * 0.13); g.lineTo(L + w * k / 7, y); } g.stroke();
    g.fillStyle = b ? '#1b1411' : '#6e4426'; g.fillRect(x - w * 0.11, y - h * 0.62, w * 0.22, h * 0.62); g.strokeStyle = b ? '#0e0a08' : '#4a2c16'; g.beginPath(); g.moveTo(x, y - h * 0.62); g.lineTo(x, y); g.stroke(); g.fillStyle = '#d8b24a'; g.beginPath(); g.arc(x + w * 0.06, y - h * 0.3, w * 0.014 + 0.6, 0, 7); g.fill();
    for (const fx of [0.09, 0.73]) { const wx = L + w * fx, wy = T + h * 0.16, ww = w * 0.18, wh = h * 0.28; g.fillStyle = b ? '#120e0c' : o.lit === false ? '#31465c' : '#ffd77a'; g.fillRect(wx, wy, ww, wh);
      if (!b && o.lit !== false) { const gl = g.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 1.6); gl.addColorStop(0, 'rgba(255,215,120,.35)'); gl.addColorStop(1, 'rgba(255,215,120,0)'); g.fillStyle = gl; g.fillRect(wx - ww, wy - wh, ww * 3, wh * 3); }
      g.strokeStyle = b ? '#0e0a08' : '#4a2c16'; g.lineWidth = Math.max(1, w * 0.02); g.strokeRect(wx, wy, ww, wh); g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke(); }
    const ov = w * 0.1; g.beginPath(); g.moveTo(L - ov, T); g.lineTo(x, T - r); g.lineTo(L + w + ov, T); g.closePath(); const rg = g.createLinearGradient(L, T - r, L + w, T); rg.addColorStop(0, b ? '#2a211d' : '#a8553a'); rg.addColorStop(1, b ? '#15100e' : '#6f3324'); g.fillStyle = rg; g.fill();
    g.save(); g.clip(); g.strokeStyle = b ? 'rgba(0,0,0,.5)' : 'rgba(60,22,14,.5)'; g.lineWidth = Math.max(1, r * 0.035); for (let k = 1; k < 6; k++) { const yy = T - r + r * k / 6; g.beginPath(); for (let q = 0; q <= 14; q++) { const xx = L - ov + (w + 2 * ov) * q / 14; g.lineTo(xx, yy + (q % 2 ? r * 0.05 : 0)); } g.stroke(); }
    if (b) { for (let k = 0; k < 7; k++) { const ex = L + w * Art.h(k + 3), ey = T - r * 0.5 * Art.h(k + 9), fl = 0.5 + 0.5 * Math.sin((o.now || 0) / 160 + k * 2); g.fillStyle = 'rgba(255,' + (90 + 80 * fl | 0) + ',30,' + (0.35 + 0.5 * fl) + ')'; g.beginPath(); g.arc(ex, ey, w * 0.022 + 0.8, 0, 7); g.fill(); } g.fillStyle = '#0b0807'; g.beginPath(); g.ellipse(x - w * 0.12, T - r * 0.32, w * 0.13, r * 0.16, 0.4, 0, 7); g.fill(); }
    g.restore(); g.strokeStyle = b ? '#0e0a08' : '#4a1f14'; g.lineWidth = Math.max(1, w * 0.03); g.beginPath(); g.moveTo(L - ov, T); g.lineTo(x, T - r); g.lineTo(L + w + ov, T); g.stroke(); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(L, T, w, h * 0.07); g.restore(); },
  // The same cottage seen from above: two roof planes, a ridge, a chimney, a doorstep. About 7 by 5.5 cells.
  roof(g, x, y, s, o = {}) { const w = 7 * s, d = 5.4 * s, b = o.burnt, L = x - w / 2, T = y - d / 2; g.save();
    g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(L + s * 0.7, T + s * 0.8, w, d); g.fillStyle = b ? '#2a2420' : '#b9ab8a'; g.fillRect(x - s * 0.9, T + d - s * 0.1, s * 1.8, s * 0.9);
    g.fillStyle = b ? '#221b18' : '#b9623f'; g.fillRect(L, T, w, d / 2); g.fillStyle = b ? '#15100e' : '#7d3d27'; g.fillRect(L, y, w, d / 2);
    g.strokeStyle = b ? 'rgba(0,0,0,.6)' : 'rgba(50,18,10,.45)'; g.lineWidth = Math.max(1, s * 0.12); g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(L, T + d * k / 8); g.lineTo(L + w, T + d * k / 8); g.moveTo(L, y + d * k / 8); g.lineTo(L + w, y + d * k / 8); } for (let k = 1; k < 10; k++) { g.moveTo(L + w * k / 10, T); g.lineTo(L + w * k / 10, T + d); } g.stroke();
    g.strokeStyle = b ? '#3a2e28' : '#e0946c'; g.lineWidth = Math.max(1.5, s * 0.3); g.beginPath(); g.moveTo(L, y); g.lineTo(L + w, y); g.stroke(); g.strokeStyle = b ? '#0c0908' : '#4a1f14'; g.lineWidth = Math.max(1, s * 0.16); g.strokeRect(L, T, w, d);
    g.fillStyle = b ? '#1a1512' : '#7a5a4a'; g.fillRect(x + w * 0.2, T + d * 0.14, s * 1.2, s * 1.2); g.fillStyle = '#17110e'; g.fillRect(x + w * 0.2 + s * 0.3, T + d * 0.14 + s * 0.3, s * 0.6, s * 0.6);
    if (b) { g.fillStyle = '#080605'; g.beginPath(); g.ellipse(x - w * 0.14, y + d * 0.05, w * 0.22, d * 0.2, 0.3, 0, 7); g.fill(); g.strokeStyle = '#3b2c22'; g.lineWidth = Math.max(1, s * 0.2); g.beginPath(); g.moveTo(x - w * 0.34, y - d * 0.1); g.lineTo(x + w * 0.05, y + d * 0.22); g.moveTo(x - w * 0.3, y + d * 0.2); g.lineTo(x + w * 0.02, y - d * 0.12); g.stroke();
      for (let k = 0; k < 9; k++) { const fl = 0.5 + 0.5 * Math.sin((o.now || 0) / 150 + k * 1.7); g.fillStyle = 'rgba(255,' + (80 + 90 * fl | 0) + ',24,' + (0.3 + 0.6 * fl) + ')'; g.beginPath(); g.arc(L + w * (0.1 + 0.8 * Art.h(k + 1)), T + d * (0.1 + 0.8 * Art.h(k + 20)), s * 0.22, 0, 7); g.fill(); } }
    else { const sm = ((o.now || 0) / 2600) % 1; for (let k = 0; k < 3; k++) { const p = (sm + k / 3) % 1; g.fillStyle = 'rgba(225,225,225,' + 0.22 * (1 - p) + ')'; g.beginPath(); g.arc(x + w * 0.2 + s * 0.6 + p * s * 2.4, T + d * 0.14 + s * 0.5 - p * s * 2.6, s * (0.4 + p * 0.9), 0, 7); g.fill(); } }
    g.restore(); },
  // A campfire seen from above: a ring of stones, crossed logs and, when lit, tongues of flame that flicker.
  campfire(g, x, y, s, lit, now) { g.save(); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.4, s * 3.3, s * 3, 0, 0, 7); g.fill(); g.fillStyle = lit ? '#3a2416' : '#26211d'; g.beginPath(); g.arc(x, y, s * 2.3, 0, 7); g.fill();
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + 0.2, r = s * 2.7, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r, q = Art.h(k + 5); g.fillStyle = 'rgb(' + (96 + 40 * q | 0) + ',' + (94 + 38 * q | 0) + ',' + (90 + 36 * q | 0) + ')'; g.beginPath(); g.ellipse(sx, sy, s * (0.75 + 0.2 * q), s * (0.6 + 0.2 * q), a, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(sx - s * 0.18, sy - s * 0.2, s * 0.3, s * 0.2, a, 0, 7); g.fill(); }
    for (const a of [0.5, 2.6, 4.2]) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = lit ? '#4a2a14' : '#6a4526'; g.fillRect(-s * 1.9, -s * 0.36, s * 3.8, s * 0.72); g.fillStyle = lit ? '#2a160a' : '#3d2613'; g.fillRect(-s * 1.9, s * 0.1, s * 3.8, s * 0.26); g.fillStyle = '#c9a26a'; g.beginPath(); g.ellipse(s * 1.9, 0, s * 0.2, s * 0.36, 0, 0, 7); g.fill(); g.restore(); }
    if (lit) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 0, x, y, s * 8); gl.addColorStop(0, 'rgba(255,190,80,.5)'); gl.addColorStop(1, 'rgba(255,190,80,0)'); g.fillStyle = gl; g.fillRect(x - s * 8, y - s * 8, s * 16, s * 16);
      const tongue = (cx, cy, w, h, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - w, cy); g.bezierCurveTo(cx - w, cy - h * 0.5, cx - w * 0.2, cy - h * 0.6, cx, cy - h); g.bezierCurveTo(cx + w * 0.2, cy - h * 0.6, cx + w, cy - h * 0.5, cx + w, cy); g.bezierCurveTo(cx + w, cy + w * 0.9, cx - w, cy + w * 0.9, cx - w, cy); g.fill(); };
      for (let k = 0; k < 5; k++) { const f = Math.sin(now / 90 + k * 2.1) * 0.5 + 0.5, ox = (k - 2) * s * 0.6 + Math.sin(now / 130 + k) * s * 0.2; tongue(x + ox, y + s * 0.5, s * (0.75 + 0.2 * f), s * (2.4 + 1.6 * f) * (k === 2 ? 1.25 : 0.9), 'rgba(255,' + (96 + 40 * f | 0) + ',10,.6)'); }
      for (let k = 0; k < 3; k++) { const f = Math.sin(now / 70 + k * 3.3) * 0.5 + 0.5; tongue(x + (k - 1) * s * 0.55, y + s * 0.5, s * 0.5, s * (1.7 + 1.1 * f), 'rgba(255,205,60,.75)'); } tongue(x, y + s * 0.5, s * 0.3, s * (1.1 + 0.5 * Math.sin(now / 60)), 'rgba(255,250,220,.9)');
      for (let k = 0; k < 5; k++) { const p = (now / 900 + k * 0.23) % 1; g.fillStyle = 'rgba(255,210,120,' + (1 - p) + ')'; g.beginPath(); g.arc(x + Math.sin(k * 5 + p * 4) * s * 1.2, y - p * s * 5.5, s * 0.14, 0, 7); g.fill(); } }
    g.restore(); },
  // A paper lantern floating on a small raft.
  lantern(g, x, y, s, lit, now) { g.save(); const bob = Math.sin(now / 700 + x) * s * 0.12; y += bob; if (lit) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 0, x, y, s * 10); gl.addColorStop(0, 'rgba(255,190,90,.6)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(x - s * 10, y - s * 10, s * 20, s * 20); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = 'rgba(0,8,16,.4)'; g.beginPath(); g.ellipse(x, y + s * 2.3, s * 2.6, s * 0.9, 0, 0, 7); g.fill(); g.fillStyle = '#6b4a2c'; g.beginPath(); g.ellipse(x, y + s * 2, s * 2.4, s * 0.8, 0, 0, 7); g.fill(); g.strokeStyle = '#3d2814'; g.lineWidth = Math.max(1, s * 0.12); g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * s * 0.9, y + s * 1.3); g.lineTo(x + k * s * 0.9, y + s * 2.7); } g.stroke();
    const body = () => { g.beginPath(); g.moveTo(x - s * 1.1, y - s * 2); g.bezierCurveTo(x - s * 2.4, y - s * 1.2, x - s * 2.4, y + s * 1.2, x - s * 1.1, y + s * 2); g.lineTo(x + s * 1.1, y + s * 2); g.bezierCurveTo(x + s * 2.4, y + s * 1.2, x + s * 2.4, y - s * 1.2, x + s * 1.1, y - s * 2); g.closePath(); };
    const bg = g.createRadialGradient(x, y, s * 0.2, x, y, s * 2.4); if (lit) { bg.addColorStop(0, '#fff2b8'); bg.addColorStop(0.45, '#ffb347'); bg.addColorStop(1, '#d9431f'); } else { bg.addColorStop(0, '#8a3a2a'); bg.addColorStop(1, '#4b1c16'); } g.fillStyle = bg; body(); g.fill();
    g.save(); body(); g.clip(); g.strokeStyle = lit ? 'rgba(150,40,10,.55)' : 'rgba(20,6,4,.6)'; g.lineWidth = Math.max(1, s * 0.11); for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(x + k * s * 0.42, y - s * 2); g.quadraticCurveTo(x + k * s * 0.85, y, x + k * s * 0.42, y + s * 2); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x - s * 0.9, y - s * 0.7, s * 0.35, s * 0.9, 0.3, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#1c1512'; g.fillRect(x - s * 1.2, y - s * 2.35, s * 2.4, s * 0.45); g.fillRect(x - s * 1.2, y + s * 1.9, s * 2.4, s * 0.45); g.strokeStyle = '#1c1512'; g.lineWidth = Math.max(1, s * 0.14); g.beginPath(); g.arc(x, y - s * 2.35, s * 0.8, Math.PI, 0); g.stroke(); g.restore(); },
  // A mallard seen from above, heading right; frozen in, it sits in a ring of ice.
  duck(g, x, y, s, now, frozen) { g.save(); if (!frozen) { y += Math.sin(now / 600) * s * 0.15; g.strokeStyle = 'rgba(210,235,255,.3)'; g.lineWidth = Math.max(1, s * 0.16); for (let k = 0; k < 2; k++) { const p = (now / 2200 + k * 0.5) % 1; g.globalAlpha = 1 - p; g.beginPath(); g.ellipse(x, y, s * (2.6 + p * 3.4), s * (1.8 + p * 2.4), 0, 0, 7); g.stroke(); } g.globalAlpha = 1; }
    else { for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, r = s * 3.3; g.fillStyle = 'rgba(' + (200 + 40 * Art.h(k) | 0) + ',232,255,.9)'; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); g.lineTo(x + Math.cos(a + 0.5) * r * 1.25, y + Math.sin(a + 0.5) * r); g.lineTo(x + Math.cos(a + 0.9) * r * 0.8, y + Math.sin(a + 0.9) * r * 0.7); g.closePath(); g.fill(); } }
    g.fillStyle = 'rgba(0,8,16,.35)'; g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.5, s * 2.5, s * 1.5, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2622'; g.beginPath(); g.moveTo(x - s * 2.9, y); g.lineTo(x - s * 1.8, y - s * 0.7); g.lineTo(x - s * 1.8, y + s * 0.7); g.closePath(); g.fill(); g.fillStyle = '#f2efe6'; g.beginPath(); g.ellipse(x - s * 1.9, y, s * 0.35, s * 0.6, 0, 0, 7); g.fill();
    const bg = g.createRadialGradient(x - s * 0.3, y - s * 0.4, s * 0.2, x, y, s * 2.4); bg.addColorStop(0, '#cfc6b6'); bg.addColorStop(1, '#8a8072'); g.fillStyle = bg; g.beginPath(); g.ellipse(x, y, s * 2.2, s * 1.35, 0, 0, 7); g.fill();
    g.fillStyle = '#6a4a34'; g.beginPath(); g.ellipse(x + s * 1.3, y, s * 0.95, s * 1.05, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(70,60,50,.7)'; g.lineWidth = Math.max(1, s * 0.13); for (const sg of [-1, 1]) { g.beginPath(); g.ellipse(x - s * 0.3, y + sg * s * 0.55, s * 1.5, s * 0.55, sg * 0.12, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - s * 1.5, y + sg * s * 0.5); g.lineTo(x + s * 0.6, y + sg * s * 0.62); g.stroke(); }
    g.fillStyle = '#2f4f8a'; g.fillRect(x - s * 0.9, y - s * 1.05, s * 0.8, s * 0.28); g.fillRect(x - s * 0.9, y + s * 0.78, s * 0.8, s * 0.28);
    g.fillStyle = '#f2efe6'; g.beginPath(); g.ellipse(x + s * 2.05, y, s * 0.28, s * 0.62, 0, 0, 7); g.fill(); const hg = g.createRadialGradient(x + s * 2.5, y - s * 0.3, s * 0.1, x + s * 2.7, y, s * 0.9); hg.addColorStop(0, '#3fa56f'); hg.addColorStop(1, '#134a32'); g.fillStyle = hg; g.beginPath(); g.arc(x + s * 2.7, y, s * 0.8, 0, 7); g.fill();
    g.fillStyle = '#e8b530'; g.beginPath(); g.moveTo(x + s * 3.3, y - s * 0.34); g.quadraticCurveTo(x + s * 4.4, y, x + s * 3.3, y + s * 0.34); g.closePath(); g.fill(); g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(x + s * 2.95, y - s * 0.42, s * 0.11, 0, 7); g.arc(x + s * 2.95, y + s * 0.42, s * 0.11, 0, 7); g.fill();
    if (frozen) { g.fillStyle = 'rgba(225,242,255,.5)'; g.beginPath(); g.ellipse(x + s * 0.4, y, s * 3.2, s * 1.7, 0, 0, 7); g.fill(); } g.restore(); },
  // A tree seen from the side. (x, y) is the foot of the trunk, h its height, r the reach of the crown.
  tree(g, x, y, h, r, seed, o = {}) { g.save(); g.translate(x, y); g.rotate(o.lean || 0); const b = o.burnt, tw = Math.max(1.5, r * 0.22);
    g.fillStyle = b ? '#1a1410' : '#4a3323'; g.beginPath(); g.moveTo(-tw, 0); g.lineTo(-tw * 0.5, -h * 0.8); g.lineTo(tw * 0.5, -h * 0.8); g.lineTo(tw, 0); g.closePath(); g.fill(); g.strokeStyle = b ? '#0c0907' : '#2e1f14'; g.lineWidth = Math.max(1, tw * 0.25); g.beginPath(); g.moveTo(-tw * 0.3, -h * 0.05); g.lineTo(-tw * 0.15, -h * 0.6); g.moveTo(tw * 0.35, -h * 0.1); g.lineTo(tw * 0.2, -h * 0.5); g.stroke();
    if (o.pine) { for (let k = 0; k < 5; k++) { const yy = -h * (0.28 + 0.16 * k), ww = r * (1 - k * 0.17), hh = h * 0.3; g.fillStyle = b ? '#201a16' : ['#163a25', '#1b4a2e', '#205636', '#256240', '#2b6e49'][k]; g.beginPath(); g.moveTo(0, yy - hh); for (let q = 0; q <= 6; q++) g.lineTo(ww - (2 * ww) * q / 6, yy + (q % 2 ? -hh * 0.12 : 0)); g.closePath(); g.fill(); if (!b) { g.fillStyle = 'rgba(190,230,170,.16)'; g.beginPath(); g.moveTo(0, yy - hh); g.lineTo(-ww, yy); g.lineTo(-ww * 0.35, yy - hh * 0.1); g.closePath(); g.fill(); } } }
    else { g.strokeStyle = b ? '#1a1410' : '#4a3323'; g.lineWidth = Math.max(1, tw * 0.6); g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -h * 0.55); g.lineTo(-r * 0.55, -h * 0.82); g.moveTo(0, -h * 0.62); g.lineTo(r * 0.5, -h * 0.9); g.stroke();
      if (b) { g.lineWidth = Math.max(1, tw * 0.35); g.beginPath(); g.moveTo(-r * 0.55, -h * 0.82); g.lineTo(-r * 0.8, -h * 1.02); g.moveTo(r * 0.5, -h * 0.9); g.lineTo(r * 0.75, -h * 1.1); g.moveTo(0, -h * 0.8); g.lineTo(r * 0.1, -h * 1.15); g.stroke(); }
      else { // a tall tree carries its leaves in several masses down the upper part of the trunk, not one ball on a stick
        // one ovoid crown built of overlapping lobes: widest a third of the way down, drawn from the shaded bottom up to the lit top
        const span = Math.max(0, h * 0.5 - r * 1.4), m = Math.max(1, Math.min(7, Math.round(span / (r * 0.7)) + 1));
        for (let k = m - 1; k >= 0; k--) { const f = m > 1 ? k / (m - 1) : 0, yy = -h + r * 0.9 + f * span, wide = 0.75 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + f * 0.9)), side = m > 1 ? (k % 2 ? 1 : -1) * r * 0.28 * Math.sin(f * 3.1) : 0;
          if (k === m - 1 && m > 1) { g.strokeStyle = '#4a3323'; g.lineWidth = Math.max(1, tw * 0.45); g.beginPath(); g.moveTo(0, yy + r * 0.9); g.lineTo(-r * 0.6, yy + r * 0.2); g.moveTo(0, yy + r * 0.6); g.lineTo(r * 0.55, yy); g.stroke(); }
          Art.foliage(g, side, yy, r * wide, seed + k * 3, 0.85); } } }
    g.restore(); },
  // A leafy mass: a ragged outline from layered noise, shaded dark below and lit above, then clumps of leaves on top.
  foliage(g, x, y, r, seed, squash) { const lobe = (cx, cy, rr, s, col) => { g.fillStyle = col; g.beginPath(); for (let k = 0; k <= 28; k++) { const a = k / 28 * 6.283, n = 0.78 + 0.16 * Math.sin(a * 5 + s) + 0.1 * Math.sin(a * 11 + s * 3) + 0.06 * Math.sin(a * 23 + s * 7); const px = cx + Math.cos(a) * rr * n, py = cy + Math.sin(a) * rr * n * squash; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); };
    g.save(); lobe(x + r * 0.08, y + r * 0.1, r * 1.02, seed, '#123320');
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + seed * 2, d = r * (0.35 + 0.15 * Art.h(seed * 7 + k)); lobe(x + Math.cos(a) * d, y + Math.sin(a) * d * squash, r * (0.5 + 0.12 * Art.h(seed + k)), seed + k * 1.7, k % 2 ? '#1d5230' : '#22603a'); }
    const lg = g.createRadialGradient(x - r * 0.4, y - r * 0.5 * squash, 0, x - r * 0.2, y - r * 0.2 * squash, r * 1.1); lg.addColorStop(0, 'rgba(160,215,120,.55)'); lg.addColorStop(0.5, 'rgba(90,160,80,.2)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); lobe(x, y, r * 0.98, seed + 0.5, lg);
    for (let k = 0; k < 46; k++) { const a = Art.h(seed * 31 + k) * 6.283, d = Math.sqrt(Art.h(seed * 17 + k)) * r * 0.85, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * squash, up = (y - ly) / r; g.fillStyle = up > 0.1 ? 'rgba(150,205,110,.55)' : up < -0.4 ? 'rgba(8,30,16,.45)' : 'rgba(60,130,70,.5)'; g.beginPath(); g.ellipse(lx, ly, r * 0.09, r * 0.06, a, 0, 7); g.fill(); }
    g.restore(); },
  // A tree crown seen from above.
  crown(g, x, y, r, seed) { g.fillStyle = 'rgba(6,20,10,.38)'; g.beginPath(); g.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.85, 0, 0, 7); g.fill(); Art.foliage(g, x, y, r, seed % 97, 1); },
  // A brass bell hanging from a bracket; (x, y) is where it hangs from.
  bell(g, x, y, s, ring) { g.save(); g.translate(x, y); g.strokeStyle = '#3a3026'; g.lineWidth = Math.max(1, s * 0.3); g.beginPath(); g.moveTo(-s * 1.2, -s * 0.4); g.lineTo(s * 1.2, -s * 0.4); g.moveTo(0, -s * 0.4); g.lineTo(0, s * 0.3); g.stroke();
    if (ring) { const gl = g.createRadialGradient(0, s * 2.2, 0, 0, s * 2.2, s * 7); gl.addColorStop(0, 'rgba(255,220,120,' + 0.5 * ring + ')'); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.fillRect(-s * 7, -s * 5, s * 14, s * 14); }
    const bg = g.createLinearGradient(-s * 2, 0, s * 2, 0); bg.addColorStop(0, '#8a6418'); bg.addColorStop(0.35, '#f3d572'); bg.addColorStop(0.6, '#c99a2e'); bg.addColorStop(1, '#6f4e10'); g.fillStyle = bg;
    g.beginPath(); g.moveTo(-s * 0.5, s * 0.3); g.bezierCurveTo(-s * 1.5, s * 0.6, -s * 1.3, s * 2.6, -s * 2.2, s * 3.5); g.lineTo(s * 2.2, s * 3.5); g.bezierCurveTo(s * 1.3, s * 2.6, s * 1.5, s * 0.6, s * 0.5, s * 0.3); g.closePath(); g.fill(); g.strokeStyle = '#5a3f0c'; g.lineWidth = Math.max(1, s * 0.14); g.stroke();
    g.fillStyle = '#a57a1e'; g.beginPath(); g.ellipse(0, s * 3.5, s * 2.2, s * 0.4, 0, 0, 7); g.fill(); g.stroke(); g.strokeStyle = 'rgba(90,60,10,.6)'; g.beginPath(); g.moveTo(-s * 1.45, s * 2.5); g.quadraticCurveTo(0, s * 2.85, s * 1.45, s * 2.5); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-s * 0.7, s * 1.7, s * 0.22, s * 0.9, 0.25, 0, 7); g.fill(); g.fillStyle = '#4a3410'; g.beginPath(); g.arc(Math.sin(ring ? Date.now() / 60 : 0) * s * 0.5 * (ring || 0), s * 3.95, s * 0.42, 0, 7); g.fill(); g.restore(); },
  moon(g, x, y, r) { g.save(); g.fillStyle = '#e9edf5'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(160,170,190,.6)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, 7); g.arc(x + r * 0.25, y + r * 0.35, r * 0.16, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x + r * 0.55, y - r * 0.2, r * 0.9, 0, 7); g.fill(); g.restore(); },
  sun(g, x, y, r) { g.save(); g.strokeStyle = '#ffc24a'; g.lineWidth = Math.max(1, r * 0.2); g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); g.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3); } g.stroke(); const sg = g.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r * 0.7); sg.addColorStop(0, '#fff3c0'); sg.addColorStop(1, '#ffab2e'); g.fillStyle = sg; g.beginPath(); g.arc(x, y, r * 0.65, 0, 7); g.fill(); g.restore(); },
  // A street lamp bulb on a wire: a cap, a glass globe and, when lit, its light.
  lamp(g, x, y, s, lit) { g.save(); if (lit) { g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 0, x, y, s * 11); gl.addColorStop(0, 'rgba(255,228,140,.85)'); gl.addColorStop(1, 'rgba(255,228,140,0)'); g.fillStyle = gl; g.fillRect(x - s * 11, y - s * 11, s * 22, s * 22); g.globalCompositeOperation = 'source-over'; }
    // an enamelled street-lamp shade: dark green outside, white inside, a rolled rim, and a pear-shaped bulb with a filament under it
    g.fillStyle = '#3c434d'; g.fillRect(x - s * 0.35, y - s * 3.6, s * 0.7, s * 1.0); g.fillStyle = '#5f6875'; g.fillRect(x - s * 0.55, y - s * 2.75, s * 1.1, s * 0.45);
    const inner = g.createLinearGradient(0, y - s * 2.4, 0, y - s * 0.6); inner.addColorStop(0, lit ? '#fff2c0' : '#9aa3ad'); inner.addColorStop(1, lit ? '#ffe7a0' : '#d5dbe0'); g.fillStyle = inner; g.beginPath(); g.moveTo(x - s * 2.7, y - s * 0.7); g.bezierCurveTo(x - s * 2.1, y - s * 1.5, x - s * 1.0, y - s * 2.4, x, y - s * 2.45); g.bezierCurveTo(x + s * 1.0, y - s * 2.4, x + s * 2.1, y - s * 1.5, x + s * 2.7, y - s * 0.7); g.closePath(); g.fill();
    const outer = g.createLinearGradient(x - s * 2.7, 0, x + s * 2.7, 0); outer.addColorStop(0, '#1d3b2f'); outer.addColorStop(0.35, '#3f7a5e'); outer.addColorStop(0.55, '#2b5c46'); outer.addColorStop(1, '#16291f'); g.fillStyle = outer; g.beginPath(); g.moveTo(x - s * 2.8, y - s * 0.75); g.bezierCurveTo(x - s * 2.2, y - s * 1.75, x - s * 1.1, y - s * 2.75, x, y - s * 2.8); g.bezierCurveTo(x + s * 1.1, y - s * 2.75, x + s * 2.2, y - s * 1.75, x + s * 2.8, y - s * 0.75); g.bezierCurveTo(x + s * 2.0, y - s * 1.35, x + s * 1.0, y - s * 1.95, x, y - s * 2.0); g.bezierCurveTo(x - s * 1.0, y - s * 1.95, x - s * 2.0, y - s * 1.35, x - s * 2.8, y - s * 0.75); g.fill();
    g.strokeStyle = '#c9ced4'; g.lineWidth = Math.max(1, s * 0.22); g.lineCap = 'round'; g.beginPath(); g.moveTo(x - s * 2.75, y - s * 0.72); g.quadraticCurveTo(x, y - s * 0.45, x + s * 2.75, y - s * 0.72); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(x - s * 1.2, y - s * 2.0, s * 0.9, s * 0.22, -0.45, 0, 7); g.fill();
    g.fillStyle = '#8a8f96'; g.fillRect(x - s * 0.5, y - s * 1.9, s * 1.0, s * 0.75); g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 3; k++) g.fillRect(x - s * 0.5, y - s * 1.8 + k * s * 0.24, s, s * 0.07);
    const bulb = () => { g.beginPath(); g.moveTo(x - s * 0.42, y - s * 1.15); g.bezierCurveTo(x - s * 0.45, y - s * 0.6, x - s * 1.15, y - s * 0.4, x - s * 1.1, y + s * 0.4); g.bezierCurveTo(x - s * 1.05, y + s * 1.25, x + s * 1.05, y + s * 1.25, x + s * 1.1, y + s * 0.4); g.bezierCurveTo(x + s * 1.15, y - s * 0.4, x + s * 0.45, y - s * 0.6, x + s * 0.42, y - s * 1.15); g.closePath(); };
    const bg = g.createRadialGradient(x - s * 0.3, y + s * 0.1, s * 0.1, x, y + s * 0.3, s * 1.4); if (lit) { bg.addColorStop(0, '#fffdf0'); bg.addColorStop(0.6, '#ffe48a'); bg.addColorStop(1, '#f0b84a'); } else { bg.addColorStop(0, 'rgba(190,200,212,.55)'); bg.addColorStop(1, 'rgba(90,100,115,.7)'); } g.fillStyle = bg; bulb(); g.fill(); g.strokeStyle = lit ? 'rgba(255,240,200,.8)' : 'rgba(200,210,222,.55)'; g.lineWidth = Math.max(0.8, s * 0.1); g.stroke();
    g.strokeStyle = lit ? '#fff' : '#3a2f22'; g.lineWidth = Math.max(0.8, s * 0.12); g.beginPath(); g.moveTo(x - s * 0.25, y - s * 0.9); g.lineTo(x - s * 0.35, y + s * 0.25); for (let k = 0; k <= 6; k++) g.lineTo(x - s * 0.35 + k * s * 0.117, y + s * 0.25 + (k % 2 ? -s * 0.16 : 0)); g.lineTo(x + s * 0.25, y - s * 0.9); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - s * 0.55, y + s * 0.15, s * 0.16, s * 0.42, 0.25, 0, 7); g.fill(); g.restore(); }
};
