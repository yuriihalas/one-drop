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
function Proto(P) {
  const $ = id => document.getElementById(id);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="wrap"><div id="top"><a href="index.html">← Стихії</a><b id="lvname"></b><span id="lvs"></span></div>' +
    '<div id="stage"><canvas id="cv"></canvas><div id="card"><div><small id="cnum"></small><h2 id="cname"></h2><p id="ctext"></p><button class="go" id="cgo">Почати</button></div></div></div>' +
    '<div id="bar"><div id="msg"></div><button id="again">Ще раз</button><button id="next" class="go">Далі</button></div>' +
    '<div id="sub">Прототип. Один дотик на спробу.</div></div>');
  const cv = $('cv'), g = cv.getContext('2d'), stage = $('stage');
  let size = 600, lv = 0, state = 'card', tries = 0;
  P.say = t => { $('msg').textContent = t; };
  function resize() {
    const css = Math.max(240, Math.min(innerWidth - 24, innerHeight - (innerWidth < 600 ? 250 : 190), 760)), dpr = Math.min(devicePixelRatio || 1, 2);
    stage.style.width = stage.style.height = css + 'px'; size = Math.round(css * dpr); cv.width = cv.height = size;
  }
  addEventListener('resize', resize); resize();
  P.levels.forEach((L, k) => { const b = document.createElement('button'); b.className = 'lv'; b.textContent = k + 1; b.title = L.name; b.onclick = () => setLevel(k); $('lvs').appendChild(b); });
  function setLevel(i) {
    lv = i; tries = 0; const L = P.levels[i]; P.L = L; P.build(L);
    document.querySelectorAll('.lv').forEach((b, k) => b.classList.toggle('cur', k === i));
    $('lvname').textContent = (i + 1) + '. ' + L.name; $('cnum').textContent = 'РІВЕНЬ ' + (i + 1) + ' З ' + P.levels.length;
    $('cname').textContent = L.name; $('ctext').textContent = L.text; $('card').classList.add('on'); $('next').style.display = 'none'; state = 'card'; P.say('');
  }
  function begin() { if (state !== 'card') return; $('card').classList.remove('on'); state = 'idle'; P.say(P.idleText || 'Торкніться поля.'); }
  function reset() { if (state === 'card') return; P.build(P.L); state = 'idle'; $('next').style.display = 'none'; P.say(P.idleText || 'Торкніться поля.'); }
  function finish(v) {
    state = v > 0 ? 'win' : 'lost';
    if (v > 0) { P.say((P.winText ? P.winText() : 'Вийшло.') + (tries === 1 ? ' З першої спроби.' : ' Спроба № ' + tries + '.')); $('next').style.display = 'inline-block'; $('next').textContent = lv < P.levels.length - 1 ? 'Далі' : 'З початку'; }
    else P.say(P.failText() + ' Торкніться поля, щоб спробувати ще раз.');
  }
  function cell(e) { const r = stage.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * P.G), Math.floor((e.clientY - r.top) / r.height * P.G)]; }
  P.hover = null;
  stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') P.hover = cell(e); });
  stage.addEventListener('pointerleave', () => { P.hover = null; });
  stage.addEventListener('pointerup', e => {
    if (e.target.closest('#card')) return;
    if (state === 'lost') { reset(); return; }
    if (state !== 'idle') return;
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= P.G || y >= P.G) return;
    if (P.tap(x, y) === false) return; tries++; state = 'run';
  });
  $('again').onclick = reset; $('cgo').onclick = begin; $('next').onclick = () => setLevel(lv < P.levels.length - 1 ? lv + 1 : 0);
  addEventListener('keydown', e => { if (e.repeat) return; if (state === 'card' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); begin(); } else if (e.code === 'KeyR') reset(); else if (e.code === 'KeyN' && state === 'win') $('next').onclick(); });
  function frame(now) {
    if (state === 'run') { for (let k = 0; k < (P.speed || 1) && state === 'run'; k++) { P.step(); const v = P.verdict(); if (v) finish(v); } }
    else if ((state === 'win' || state === 'lost') && P.after) P.after();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, size, size); P.state = state; P.draw(g, size / P.G, now, size);
    requestAnimationFrame(frame);
  }
  // Test hook: jump to a level, tap a cell, run to the end without drawing.
  window.__p = {
    level: i => { setLevel(i); begin(); },
    tap: (x, y) => { reset(); if (P.tap(x, y) === false) return 'refused'; tries++; state = 'run'; let n = 0; while (state === 'run' && n++ < 200000) { P.step(); const v = P.verdict(); if (v) finish(v); } return state; },
    state: () => state, P
  };
  setLevel(0); requestAnimationFrame(frame);
}
// Small helpers shared by the prototypes.
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function emoji(g, ch, x, y, px) { g.font = Math.round(px) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y); }
