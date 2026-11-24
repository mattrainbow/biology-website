/* Forelimb morph: state, controls, camera and labels.
   Bones come from skeleton.js, drawing from renderer.js, animals from data.js. */
IX.define('forelimbs', function (root) {
'use strict';
const D = FORELIMBS, ANIMALS = D.ANIMALS, NA = ANIMALS.length, K = SKELETON, cl = K.cl, ease = K.ease, add = K.add;
const BW = 1.35, CB = 1.15;       // bones drawn a little thicker so labels fit on them
const TAN = Math.tan(10 * Math.PI / 180); // a narrow lens keeps bones pointing at the viewer from ballooning
const RX0 = -.42, RY0 = .32, ZOOM = [.12, 2.5], MIN_FS = 6, SPEED = 1 / 3.2;
const BONE_ORDER = ['hum', 'rad', 'uln', 'carp', 'mc', 'ph'];
const ON_BONE = { hum: 'Humerus', rad: 'Radius', uln: 'Ulna', carp: 'Carpals', mc: 'Metacarpal', ph: 'Phalanges' };
const options = ANIMALS.map((a, j) => '<option value="' + j + '">' + a.short + '</option>').join('');

root.innerHTML =
  '<div class="ix fl"><div class="ix-stage fl-stage">' +
    '<canvas tabindex="0" role="img" aria-label="3D skeleton of a mammal forelimb that morphs between nine species. Arrow keys rotate it."></canvas>' +
    '<div class="fl-sil" aria-hidden="true">' + ANIMALS.map(a => '<svg viewBox="0 0 200 140">' + D.SIL[a.id] + '</svg>').join('') + '</div>' +
    '<div class="fl-labels" aria-hidden="true"></div><div class="fl-bones"><b>Names of Bones</b><ul></ul></div>' +
    '<div class="fl-five">All these animals have exactly five fingers, or degenerate derivatives of five original fingers</div>' +
    '<div class="fl-hint">Drag to rotate · double-click to reset</div></div>' +
  '<div class="ix-row"><button type="button" class="ix-btn fl-play">Play</button><input class="grow fl-t" type="range" min="0" max="' + (NA - 1) * 1000 + '" value="0" aria-label="Position in the sequence of limbs"></div>' +
  '<div class="ix-row ix-chips fl-chips" role="group" aria-label="Jump to an animal">' + ANIMALS.map((a, j) => '<button type="button" class="ix-btn quiet" data-j="' + j + '" aria-pressed="false" title="' + D.GROUPS[a.grp] + '" style="--gc:var(--fl-' + a.grp + ')"><i></i>' + a.short + '</button>').join('') + '</div>' +
  '<p class="ix-note fl-cap" aria-live="polite"></p>' +
  '<div class="ix-row" role="group" aria-label="Compare any two animals"><label class="ix-field">Compare <select class="fl-from">' + options + '</select></label><label class="ix-field">with <select class="fl-to">' + options + '</select></label><button type="button" class="ix-btn quiet fl-pair">Morph</button></div>' +
  '<div class="ix-row"><label class="ix-field"><input type="radio" name="fl-mode" value="type" checked>Color by bone</label><label class="ix-field"><input type="radio" name="fl-mode" value="digit">Color by finger</label>' +
    '<label class="ix-field"><input type="checkbox" class="fl-lbl" checked>Labels</label><label class="ix-field"><input type="checkbox" class="fl-mem" checked>Skin</label>' +
    '<button type="button" class="ix-btn quiet fl-in" aria-label="Zoom in">Zoom in</button><button type="button" class="ix-btn quiet fl-out" aria-label="Zoom out">Zoom out</button><button type="button" class="ix-btn quiet fl-reset">Reset view</button></div>' +
  '<ul class="fl-legend" hidden></ul></div>';

const $ = s => root.querySelector(s), stage = $('.fl-stage'), cv = $('canvas'), R = LimbRenderer(cv, IX.token(root, '--stage-bg') || '#000000');
if (!R) { // no WebGL: leave only the message
  $('.fl').innerHTML = '<div class="ix-stage"><p class="ix-fail">This interactive needs WebGL, which is turned off or unavailable in this browser.</p></div>'; return; }
const lay = $('.fl-labels'), silBox = $('.fl-sil'), silEls = Array.from(silBox.children), bonesEl = $('.fl-bones'), boneList = $('.fl-bones ul'), five = $('.fl-five'), hint = $('.fl-hint');
const playB = $('.fl-play'), slider = $('.fl-t'), chips = Array.from(root.querySelectorAll('.fl-chips button')), cap = $('.fl-cap'), fromS = $('.fl-from'), toS = $('.fl-to'), pairB = $('.fl-pair'), legend = $('.fl-legend');

// ----- state -----
let view = 'seq', pa = 0, pb = NA - 1, k2 = 0, goal2 = null; // 'seq' runs through all nine in order; 'pair' morphs directly between two chosen animals
let t = 0, goal = null, auto = false, dwell = 0, spd = SPEED, mode = 'type', showL = true, showM = true, zoom = 1, touched = false, clock = 0;
let rx = RX0, ry = RY0, Wd = 0, Hd = 0, boxes = null, boxKey = '', P = null, poseKey = '';
const reduce = IX.reducedMotion();

// ----- pose, recomputed only when the morph position changes -----
const effR = b => b.r * BW * Math.min(1, Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) / .25);
function hoofOf(p) { const w = p.b.id === 'horse' ? ease(cl((p.k - .55) / .45)) : p.a.id === 'horse' ? ease(cl((.45 - p.k) / .45)) : 0; return { w: w, b: p.bones.find(b => b.g === 3 && b.q === 3) }; }
function currentPose() {
  const key = view + (view === 'seq' ? t : pa + '/' + pb + '/' + k2); if (key === poseKey) return P; poseKey = key;
  const p = P = view === 'seq' ? K.pose(t) : K.poseAB(ANIMALS[pa], ANIMALS[pb], k2); p.skin = K.outline(p);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const ext = q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); };
  [p.S, p.E, p.W].forEach(ext); p.J.forEach(J => J.forEach(ext)); p.skin.forEach(ext);
  p.box = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2 + 1.3, hh: (y1 - y0) / 2 + 1.4 }; p.hoof = hoofOf(p);
  return p;
}

// ----- painting -----
let typeCol, digCol;
const SKIN = R.lin('#b38a70');
function paint() {
  typeCol = {}; Object.keys(D.TYPE).forEach(k => { typeCol[k] = R.lin(D.TYPE[k][1]); }); digCol = D.DIG.map(d => R.lin(d[1]));
  const byBone = mode === 'type';
  boneList.innerHTML = BONE_ORDER.map(k => '<li style="--c:' + (byBone ? D.TYPE[k][1] : '#9aa3ab') + '"><i></i>' + D.TYPE[k][0] + '</li>').join('');
  legend.hidden = byBone; legend.innerHTML = D.DIG.map(d => '<li style="--c:' + d[1] + '"><i></i>' + d[0] + '</li>').join('');
  run.request();
}
function render() {
  if (!Wd) return;
  const p = currentPose(), fit = Math.max(p.box.hw / (TAN * (Wd / Hd) * (Wd - 32) / Wd), p.box.hh / (TAN * (Hd - 40) / Hd), 4);
  const cam = { rx: rx, ry: ry, cx: p.box.cx, cy: p.box.cy, dist: fit * zoom, tan: TAN };
  const bones = p.bones.map(b => ({ a: b.a, b: b.b, r: effR(b), col: mode === 'type' ? typeCol[b.k] : digCol[b.g] }));
  const dots = p.carps.map(c => ({ x: c[0], y: c[1], r: p.cr * CB }));
  R.draw(cam, bones, dots, mode === 'type' ? typeCol.carp : digCol[0], showM ? { pts: p.skin, color: SKIN, alpha: .6 } : null, p.hoof.w > .01 ? { a: p.hoof.b.a, b: p.hoof.b.b, alpha: p.hoof.w } : null);
  const sw = ease(cl((p.k - .25) / .5)); silEls.forEach((e, j) => set(e, 'opacity', ((j === p.ia ? 1 - sw : j === p.ib ? sw : 0) * .9).toFixed(2))); // silhouettes crossfade
  placeLabels(p, cam);
}

// ----- labels -----
const set = (el, prop, v) => { if (el['_' + prop] !== v) { el['_' + prop] = v; el.style[prop] = v; } };
const mk = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text || ''; lay.appendChild(el); return el; };
const FONT_BODY = IX.token(root, '--font-body'), FONT_HEAD = IX.token(root, '--font-heading'), mctx = document.createElement('canvas').getContext('2d'), rc = {};
function ratio(s, fam, w) { const f = (w || 600) + ' 100px ' + (fam || FONT_BODY); return rc[f + s] || (mctx.font = f, rc[f + s] = mctx.measureText(s).width / 100); }
const boneLb = BONE_ORDER.map(k => ({ k: k, el: mk('fl-lb', ON_BONE[k]) })), digLb = ['I', 'II', 'III', 'IV', 'V'].map(s => ({ s: s, el: mk('fl-lb fl-dg', s) }));
const nameEl = mk('fl-name'), nameT = document.createElement('b'), nameG = document.createElement('span'); nameEl.appendChild(nameT); nameEl.appendChild(nameG);
const TARGET = {
  hum: p => p.bones[0], rad: p => p.bones[1], uln: p => p.bones[2], mc: p => p.bones.find(b => b.g === 3 && b.k === 'mc'), ph: p => p.bones.find(b => b.g === 3 && b.q === 1),
  carp: p => ({ a: p.carps[4], b: p.carps[7], rad: p.cr * CB * .9, ext: p.cr * CB * 1.6 })
};
const at = (x, y, rest) => 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)' + (rest || '');

function placeLabels(p, cam) {
  const cx = Math.cos(cam.rx), sx = Math.sin(cam.rx), cy = Math.cos(cam.ry), sy = Math.sin(cam.ry), F = Hd / 2 / TAN;
  const S = q => { const x = q[0] - cam.cx, y = q[1] - cam.cy, wy = sx * sy * x + cx * y, wz = -cx * sy * x + sx * y, k = F / (cam.dist - wz); return { x: Wd / 2 + cy * x * k, y: Hd / 2 - wy * k, k: k }; };

  // animal name and its group, under the silhouette in the top-right corner
  const cur = p.k < .5 ? p.a : p.b, op = cl(Math.abs(p.k - .5) * 2.4 - .2), same = p.a.grp === p.b.grp, G = D.GROUPS[cur.grp];
  const fsN = Wd < 600 ? 22 : Wd < 1000 ? 26 : 30, fsG = Wd < 600 ? 13 : 15, nameW = Math.max.apply(null, ANIMALS.map(a => Math.max(fsN * ratio(a.name, FONT_HEAD, 700), fsG * ratio(D.GROUPS[a.grp]))));
  if (nameT.textContent !== cur.name) nameT.textContent = cur.name;
  if (nameG.textContent !== G) { nameG.textContent = G; nameG.style.setProperty('--gc', 'var(--fl-' + cur.grp + ')'); }
  set(nameT, 'opacity', op.toFixed(2)); set(nameG, 'opacity', (same ? 1 : op).toFixed(2)); set(nameT, 'fontSize', fsN + 'px'); set(nameG, 'fontSize', fsG + 'px');
  const key = Wd + 'x' + Hd + cur.name + G;
  if (!boxes || boxKey !== key) { // measure the fixed text only when it changes
    boxKey = key; const o = stage.getBoundingClientRect(), sil = silBox.getBoundingClientRect(), nx = Math.min(Wd - 18 - sil.width / 2, Wd - 12 - nameW / 2), ny = 14 + sil.height + 8 + (fsN + 8 + fsG) / 2;
    set(nameEl, 'transform', at(nx, ny));
    boxes = [bonesEl, silBox, hint, nameEl, five].map(el => { const r = el.getBoundingClientRect(); return [r.left - o.left + r.width / 2, r.top - o.top + r.height / 2, r.width / 2, r.height / 2]; });
  }
  const placed = boxes.slice();

  // bone names sit on their bones and shrink with them; below a readable size they disappear
  boneLb.forEach(l => {
    const b = TARGET[l.k](p), rad = b.rad || effR(b) * .78, A = S(b.a), B = S(b.b), k = (A.k + B.k) / 2, dx = B.x - A.x, dy = B.y - A.y, r = ratio(ON_BONE[l.k]);
    const fs = Math.min(1.6 * rad * k, (Math.hypot(dx, dy) + (b.ext || 0) * k) * .8 / r, 24), on = showL && fs >= MIN_FS;
    set(l.el, 'display', on ? 'block' : 'none'); if (!on) return;
    let a = Math.atan2(dy, dx); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, tw = fs * r / 2, th = fs * .35, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    set(l.el, 'fontSize', fs.toFixed(1) + 'px'); set(l.el, 'transform', at(mx, my, ' rotate(' + (a * 180 / Math.PI).toFixed(1) + 'deg)'));
    placed.push([mx, my, c * tw + s * th, s * tw + c * th]);
  });
  if (!showL) { digLb.forEach(d => set(d.el, 'display', 'none')); return; }

  // finger numbers just past each fingertip, nudged sideways if a bone is in the way
  const obs = []; p.bones.forEach(b => { if (Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) < .02) return; const A = S(b.a); obs.push({ A: A, B: S(b.b), r: effR(b) * A.k }); });
  p.carps.forEach(c => { const A = S(c); obs.push({ A: A, B: A, r: p.cr * CB * A.k }); });
  if (p.hoof.w > .3) { const A = S(p.hoof.b.a); obs.push({ A: A, B: S(p.hoof.b.b), r: .34 * A.k }); }
  const clear = (x, y, hw, hh) => obs.every(o => { // a box against a thick line, sampled along the line
    const n = Math.min(12, 1 + Math.ceil(Math.hypot(o.B.x - o.A.x, o.B.y - o.A.y) / 8));
    for (let i = 0; i <= n; i++) { const px = o.A.x + (o.B.x - o.A.x) * i / n, py = o.A.y + (o.B.y - o.A.y) * i / n; if (Math.hypot(Math.max(Math.abs(px - x) - hw, 0), Math.max(Math.abs(py - y) - hh, 0)) < o.r + 2) return false; }
    return true;
  });
  const free = (x, y, hw, hh) => x - hw > 4 && x + hw < Wd - 4 && y - hh > 4 && y + hh < Hd - 4 && placed.every(q => Math.abs(q[0] - x) > q[2] + hw + 4 || Math.abs(q[1] - y) > q[3] + hh + 4);
  digLb.forEach((d, j) => {
    const J = p.J[j]; let L = 0; for (let i = 1; i < J.length; i++) L += Math.hypot(J[i][0] - J[i - 1][0], J[i][1] - J[i - 1][1]);
    set(d.el, 'display', L < .15 ? 'none' : 'block'); if (L < .15) return;
    const e = K.along(J, 1), T = S(e[0]), T2 = S(add(e[0], e[1], .3)); let ux = T2.x - T.x, uy = T2.y - T.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    // sideways means away from the middle finger, so a number can never end up on the wrong side of the limb
    let side = [-uy, ux]; if (j !== 2) { let near = 1e9, qx = 0, qy = 0; for (let i = 0; i <= 12; i++) { const q = S(K.along(p.J[2], i / 12)[0]), m = Math.hypot(q.x - T.x, q.y - T.y); if (m < near) { near = m; qx = q.x; qy = q.y; } } if (side[0] * (T.x - qx) + side[1] * (T.y - qy) < 0) side = [uy, -ux]; }
    const hw = 4.5 * d.s.length + 3, hh = 9, dirs = [[ux, uy], side], reach = [12, 18, 26, 36, 48]; let best = null;
    for (let a = 0; a < 2 && !best; a++) for (let b = 0; b < 5; b++) { const x = T.x + dirs[a][0] * reach[b], y = T.y + dirs[a][1] * reach[b]; if (free(x, y, hw, hh) && clear(x, y, hw, hh)) { best = [x, y]; break; } }
    if (!best) best = [T.x + (ux + side[0]) * 12, T.y + (uy + side[1]) * 12];
    set(d.el, 'transform', at(best[0], best[1])); placed.push([best[0], best[1], hw, hh]);
  });
}

// ----- playback -----
function sync() {
  const A = ANIMALS[pa], B = ANIMALS[pb], say = s => { if (cap.textContent !== s) cap.textContent = s; };
  pairB.textContent = view === 'pair' && goal2 !== null ? 'Pause' : view === 'pair' && k2 > .999 ? 'Back to ' + A.short : 'Morph to ' + B.short;
  if (view === 'pair') {
    slider.max = 1000; slider.value = Math.round(k2 * 1000); slider.setAttribute('aria-label', 'Morph from ' + A.short + ' to ' + B.short);
    chips.forEach(b => b.setAttribute('aria-pressed', 'false'));
    say(B.id === 'horse' && A.id !== 'horse' && k2 > .04 && k2 < .96 ? B.via : (k2 < .5 ? A : B).cap); playB.textContent = 'Play all nine';
  } else {
    slider.max = (NA - 1) * 1000; slider.value = Math.round(t * 1000); slider.setAttribute('aria-label', 'Position in the sequence of limbs');
    const near = Math.round(t), here = Math.abs(t - near) < .02, i = Math.min(NA - 2, Math.floor(t)), k = t - i, b = ANIMALS[i + 1];
    chips.forEach((c, j) => c.setAttribute('aria-pressed', here && j === near ? 'true' : 'false'));
    say(b.via && k > .04 && k < .96 ? b.via : ANIMALS[near].cap);
    playB.textContent = auto || goal !== null ? 'Pause' : t >= NA - 1 - 1e-3 ? 'Play again' : 'Play';
  }
  run.request();
}
function advance(dt) {
  if (view === 'pair') {
    if (goal2 === null) return false;
    const d = goal2 - k2, mv = dt / 3.6; if (Math.abs(d) <= mv) { k2 = goal2; goal2 = null; } else k2 += Math.sign(d) * mv;
    sync(); return true;
  }
  if (goal === null) return false;
  if (dwell > 0) { dwell -= dt; return true; }
  const d = goal - t, mv = spd * dt;
  if (Math.abs(d) <= mv) { t = goal; if (auto && goal < NA - 1) { goal++; dwell = 1.6; } else { goal = null; auto = false; } } else t += Math.sign(d) * mv;
  sync(); return true;
}
const run = IX.runner(cv, {
  resize: (w, h, d) => { Wd = w; Hd = h; boxes = null; cv.width = Math.round(w * d); cv.height = Math.round(h * d); render(); },
  frame: dt => {
    const moving = advance(dt), sway = !touched && !reduce;
    if (sway) { clock += dt; ry = RY0 + .28 * Math.sin(clock / 2.6); }
    render(); return moving || sway;
  }
});
R.onrestore = () => run.request();

// ----- interaction -----
const clampZ = z => Math.max(ZOOM[0], Math.min(ZOOM[1], z)), setZoom = z => { zoom = clampZ(z); run.request(); };
const turn = (dx, dy) => { touched = true; ry += dx; rx = Math.max(-1.5, Math.min(1.5, rx + dy)); run.request(); };
const ptr = new Map(); let pinch0 = 0, zoom0 = 1;
const spread = () => { const v = Array.from(ptr.values()); return Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); };
cv.addEventListener('pointerdown', e => { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); if (ptr.size === 2) { pinch0 = spread(); zoom0 = zoom; } });
cv.addEventListener('pointermove', e => {
  const q = ptr.get(e.pointerId); if (!q) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptr.size === 2) { if (pinch0) setZoom(zoom0 * pinch0 / spread()); return; }
  turn((e.clientX - q[0]) * .009, (e.clientY - q[1]) * .009);
});
const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
// plain scrolling moves the page; pinching a trackpad or Ctrl + scroll zooms
cv.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * Math.exp(e.deltaY * .006)); }, { passive: false });
cv.addEventListener('keydown', e => { const m = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[e.key]; if (m) { e.preventDefault(); turn(m[0], m[1]); } });
const resetView = () => { rx = RX0; ry = RY0; zoom = 1; touched = false; clock = 0; run.request(); };
cv.addEventListener('dblclick', resetView); $('.fl-reset').onclick = resetView;
$('.fl-in').onclick = () => setZoom(zoom / 1.3); $('.fl-out').onclick = () => setZoom(zoom * 1.3);

function goTo(j) { view = 'seq'; auto = false; goal = j; spd = Math.max(SPEED, Math.abs(j - t) / 2.4); dwell = 0; sync(); }
chips.forEach(b => { b.onclick = () => goTo(+b.getAttribute('data-j')); });
playB.onclick = () => {
  if (view === 'pair') { view = 'seq'; goal2 = null; } else if (auto || goal !== null) { auto = false; goal = null; sync(); return; }
  if (t >= NA - 1 - 1e-3) t = 0;
  auto = true; spd = SPEED; const onStop = Math.abs(t - Math.round(t)) < 1e-3; goal = Math.min(NA - 1, onStop ? Math.round(t) + 1 : Math.ceil(t)); dwell = onStop ? .4 : 0; sync();
};
slider.addEventListener('input', () => { if (view === 'pair') { goal2 = null; k2 = slider.value / 1000; } else { auto = false; goal = null; t = slider.value / 1000; } sync(); });
fromS.value = pa; toS.value = pb;
function choose(e) {
  pa = +fromS.value; pb = +toS.value;
  if (pa === pb) { if (e.target === fromS) { pb = (pa + 1) % NA; toS.value = pb; } else { pa = (pb + NA - 1) % NA; fromS.value = pa; } }
  view = 'pair'; auto = false; goal = null; k2 = 0; goal2 = null; sync();
}
fromS.onchange = toS.onchange = choose;
pairB.onclick = () => { if (view !== 'pair') { view = 'pair'; auto = false; goal = null; k2 = 0; goal2 = 1; } else if (goal2 !== null) goal2 = null; else goal2 = k2 > .5 ? 0 : 1; sync(); };
Array.prototype.forEach.call(root.querySelectorAll('input[name=fl-mode]'), r => { r.onchange = () => { mode = r.value; paint(); }; });
$('.fl-lbl').onchange = e => { showL = e.target.checked; run.request(); };
$('.fl-mem').onchange = e => { showM = e.target.checked; run.request(); };

paint(); run.measure(); sync();

// used by tools/thumbnails.py and for debugging in the browser console
root.interactive = {
  thumbnail: () => { // four limbs side by side: human, bat, whale and horse
    run.stop(); showL = false; touched = true; rx = -.3; ry = .25; mode = 'type'; paint(); run.stop();
    const sheet = document.createElement('canvas'), g = sheet.getContext('2d'), w = cv.clientWidth, h = cv.clientHeight; sheet.width = w; sheet.height = h;
    Wd = cv.width = w / 2; Hd = cv.height = h / 2;
    [0, 4, 6, 8].forEach((pos, i) => { t = pos; view = 'seq'; zoom = [.8, .84, .86, .86][i]; render(); g.drawImage(cv, i % 2 * Wd, (i >> 1) * Hd); });
    stage.innerHTML = ''; stage.appendChild(sheet);
  },
  show: (pos, a, b, z) => { view = 'seq'; goal = null; t = pos; touched = true; if (a != null) rx = a; if (b != null) ry = b; if (z) zoom = z; sync(); render(); },
  render: render, info: () => ({ t: t, view: view, k2: k2, rx: rx, ry: ry, zoom: zoom, tier: run.tier() })
};
});
