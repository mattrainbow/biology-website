/* Finch upper beak development. Plain Canvas 2D, no dependencies.
   Mounts on every [data-interactive="finch-beak"] element.

   How it stays fast:
   - fixed 1/60 s simulation steps with a per-frame time budget
   - cells are drawn in batches of one colour, settled bone cells as a sprite
   - finished collagen and capillaries are baked once into offscreen layers
   - nothing runs off screen; resolution drops if frames get slow */
(function () {
'use strict';

const W = 1200, H = 560;
// ----- beak geometry: u = 0 at the face, 1 at the tip -----
const X0 = 80, X1 = 1130, L = X1 - X0, YB = 420, TH = 300;
const bot = u => YB + 18 * u * u;
const thick = u => Math.max(0, TH * (1 - u) * (1 + 1.1 * u));
const top = u => bot(u) - thick(u);
const uOf = x => (x - X0) / L;
const PZW = 72, R0 = 7.5, CYCLE = 2.4, MIT = 0.22, NB = 8;
const STEP = 1 / 60, TAU = Math.PI * 2;

// boundary samples (outer surface: culmen on top, cutting edge below)
const NS = 240, BT = [], BB = [];
for (let i = 0; i < NS; i++) { const u = i / (NS - 1); BT.push([X0 + u * L, top(u)]); BB.push([X0 + u * L, bot(u)]); }
const BXs = new Float64Array(NS), BTy = new Float64Array(NS), BBy = new Float64Array(NS);
for (let i = 0; i < NS; i++) { BXs[i] = BT[i][0]; BTy[i] = BT[i][1]; BBy[i] = BB[i][1]; }

// depth below the nearest surface and the inward normal; results land in dD, dNx, dNy
let dD = 0, dNx = 0, dNy = 0;
function depthAt(x, y) {
  const i0 = Math.round(uOf(x) * (NS - 1)), a = Math.max(0, i0 - 32), z = Math.min(NS - 1, i0 + 32);
  let best = 1e9, bx = 0, by = 0;
  for (let s = 0; s < 2; s++) {
    const Y = s ? BBy : BTy; let bi = a, bd = 1e9;
    for (let i = a; i <= z; i += 5) { const ex = x - BXs[i], ey = y - Y[i], d = ex * ex + ey * ey; if (d < bd) { bd = d; bi = i; } }
    for (let i = Math.max(a, bi - 4), e = Math.min(z, bi + 4); i <= e; i++) { const ex = x - BXs[i], ey = y - Y[i], d = ex * ex + ey * ey; if (d <= bd) { bd = d; bi = i; } }
    if (bd < best) { best = bd; bx = BXs[bi]; by = Y[bi]; }
  }
  dD = Math.sqrt(best); dNx = (x - bx) / (dD || 1); dNy = (y - by) / (dD || 1);
  if (dD < .5) { const u = uOf(x); dNx = 0; dNy = y < (top(u) + bot(u)) / 2 ? 1 : -1; }
}
// layer boundaries at u; results land in bE, bV, bD
let bE = 0, bV = 0, bD = 0;
function bands(u) {
  const h = thick(Math.min(1, Math.max(0, u))) / 2, s = Math.min(1, h / 90);
  bE = Math.min(14, h * .45); bV = bE + 28 * s; bD = bV + 30 * s;
}
const uMaxC = [];
function uMax(r) {
  const k = Math.round(r * 4); if (uMaxC[k] !== undefined) return uMaxC[k];
  let lo = 0, hi = 1; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (thick(m) > 2 * r) lo = m; else hi = m; }
  return (uMaxC[k] = lo);
}

// ----- colours -----
const C = { pz: [71, 71, 71], E: [90, 90, 90], sen: [154, 158, 164], mel: [8, 8, 8], yel: [218, 180, 44], V: [107, 107, 107], D: [138, 138, 138], B: [214, 214, 214] };
const OXY = [232, 55, 47], DEOXY = [70, 98, 224], NBK = 10, FADE = 10;
const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const rgb = a => 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')';
// cell colours as they fade from progress-zone gray: PAL[type][0..FADE] = {body, nuc}
const PAL = {};
Object.keys(C).forEach(k => { PAL[k] = []; for (let i = 0; i <= FADE; i++) { const c = mix(C.pz, C[k], i / FADE); PAL[k].push({ body: rgb(c), nuc: rgb(mix(c, [0, 0, 0], .32)) }); } });
const BLOOD = []; for (let b = 0; b < NBK; b++) { const c = mix(OXY, DEOXY, b / (NBK - 1)); BLOOD.push(c); }

// angle tables for the amoeboid outlines
const NP = 14, cA = [], sA = [], c3 = [], s3 = [], c5 = [], s5 = [];
for (let k = 0; k < NP; k++) { const a = k / NP * TAU; cA.push(Math.cos(a)); sA.push(Math.sin(a)); c3.push(Math.cos(3 * a)); s3.push(Math.sin(3 * a)); c5.push(Math.cos(5 * a)); s5.push(Math.sin(5 * a)); }
const bxs = new Float64Array(NP), bys = new Float64Array(NP);

const G = 22, GW = Math.ceil(W / G) + 2, GH = Math.ceil(H / G) + 2, MAXC = 4000;
const head = new Int32Array(GW * GH), next = new Int32Array(MAXC), gcx = new Int32Array(MAXC), gcy = new Int32Array(MAXC);
const px = new Float64Array(MAXC), py = new Float64Array(MAXC), pr = new Float64Array(MAXC), pm = new Float64Array(MAXC);
const NX = Math.ceil(L / 8) + 1, xb = x => Math.max(0, Math.min(NX - 1, Math.round((x - X0) / 8)));
const DPRS = [2, 1.5, 1, .75];

function surf(B, u0, sx, d) {
  const u = Math.min(1, Math.max(0, u0 + sx / L)), f = B === BT ? top : bot, y = f(u), y2 = f(Math.min(1, u + .002)), y1 = f(Math.max(0, u - .002));
  const tx = .004 * L, ty = y2 - y1, tl = Math.hypot(tx, ty); let nx = -ty / tl, ny = tx / tl;
  if ((B === BT && ny < 0) || (B === BB && ny > 0)) { nx = -nx; ny = -ny; }
  return [X0 + u * L + nx * d, y + ny * d];
}
function catmull(P, n) {
  const o = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; o.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  o.push(P[P.length - 1]); return o;
}
function fiber(cx, cy, a, len, bend, dl) {
  const c = Math.cos(a), s = Math.sin(a), h = len / 2;
  return { p0: [cx - c * h, cy - s * h], p1: [cx - s * bend, cy + c * bend], p2: [cx + c * h, cy + s * h], x: cx, dl: dl, baked: false };
}

function mount(root) {
  root.innerHTML =
    '<div class="fb"><div class="fb-stage"><canvas role="img" aria-label="Animation of a beak growing left to right from a progress zone, then its cells sorting into epithelium, vascular layer, dermis and bone"></canvas></div>' +
    '<div class="fb-ctl"><button type="button" class="fb-play">Pause</button><button type="button" class="fb-alt fb-restart">Restart</button>' +
    '<label>Speed<input class="fb-speed" type="range" min="0.25" max="3" step="0.25" value="1"><span class="fb-spv">1×</span></label>' +
    '<label><input class="fb-labels" type="checkbox" checked><span>Labels</span></label>' +
    '<label><input class="fb-zone" type="checkbox" checked><span>Shade zone</span></label>' +
    '<span class="fb-stat"></span></div></div>';
  const $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d', { alpha: false }), playB = $('.fb-play'), sp = $('.fb-speed'), spv = $('.fb-spv'), labelsOn = $('.fb-labels'), zoneOn = $('.fb-zone'), stat = $('.fb-stat');
  const under = document.createElement('canvas'), over = document.createElement('canvas'), bone = document.createElement('canvas');
  const uctx = under.getContext('2d', { alpha: false }), octx = over.getContext('2d');

  let cells, fibD, fibB, caps, pig, locF, leaveT, t, done, doneT, divisions, seed, tick = 0;
  let running = true, speed = 1, tier = 0, scale = 1, offY = 0, viewH = H, cssW = 0, boneHalf = 20, statNext = 0;

  function R() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function mk(x, y, r, ph) {
    return { x: x, y: y, r: r, ph: ph, len: CYCLE * (.85 + .3 * R()), ax: 1, ay: 0, q: false, qT: 0, diffT: 0, fate: null, sub: null, kind: 'pz', nx: 0, ny: 1, dep: 50, fs: 0, ph2: 0, hd: 0, set: 0, oa: 0, tr: 0, settleT: 0, dA: null };
  }

  // ----- extracellular structures, laid out once along the final layers -----
  function build() {
    fibD = []; fibB = []; caps = [];
    for (let n = 0; n < 760; n++) { // dermal collagen: woven roughly parallel to the surface
      const u = .01 + R() * .95, B = R() < .55 ? BT : BB, i = Math.round(u * (NS - 1)); bands(u);
      const v1 = bV, d1 = bD; if (d1 - v1 < 6) continue;
      const p0 = B[Math.max(0, i - 1)], p1 = B[Math.min(NS - 1, i + 1)]; let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      let nx = -ty, ny = tx; if ((B === BT && ny < 0) || (B === BB && ny > 0)) { nx = -nx; ny = -ny; }
      const dd = v1 + 2 + R() * (d1 - v1 - 4), cx = B[i][0] + nx * dd, cy = B[i][1] + ny * dd; depthAt(cx, cy);
      if (Math.abs(dD - dd) > 3) continue;
      const a = Math.atan2(ty, tx) + (R() < .65 ? (R() - .5) * .6 : (R() < .5 ? 1 : -1) * (.7 + R() * .5)), len = 16 + R() * 22, bend = (R() - .5) * 10;
      fibD.push(fiber(cx, cy, a, len, bend, 5 + R() * 4));
    }
    for (let n = 0; n < 1500 && fibB.length < 640; n++) { // bone collagen: lamellae along the beak's axis
      const x = X0 + 8 + R() * (L * .8), u = uOf(x), y = top(u) + R() * thick(u); bands(u); const d1 = bD; depthAt(x, y);
      if (dD < d1 + 4) continue;
      const mid = Math.atan2((top(u + .01) + bot(u + .01)) / 2 - (top(u) + bot(u)) / 2, .01 * L);
      const a = mid + (R() < .6 ? (R() - .5) * .35 : (R() < .5 ? 1 : -1) * (.8 + R() * .4)), len = 18 + R() * 26;
      fibB.push(fiber(x, y, a, len, (R() - .5) * 8, 8 + R() * 5));
    }
    // capillary beds: an arteriole feeds a knot of meandering capillaries that rejoin into a venule
    for (const B of [BT, BB]) {
      let u = .025;
      while (u < .96) {
        const w = 48 + R() * 44, u0 = u + w / 2 / L; bands(u0); const e1 = bE, v1 = bV; u += (w + 8 + R() * 16) / L;
        if (v1 - e1 < 12) continue;
        const lo = e1 + 2, hi = v1 - 2, dDeep = v1 + 8, n = 3 + ((R() * 3) | 0), paths = []; let ok = true;
        const ent = [-w / 2 + 5, hi - 1 - R() * 3], ext = [w / 2 - 5, hi - 1 - R() * 3];
        for (let k = 0; k < n && ok; k++) {
          const lvl = lo + (hi - lo) * (n - k - .5) / n, band = (hi - lo) / n, ctrl = [[-w / 2, dDeep], ent], m = 3 + ((R() * 4) | 0);
          for (let j = 1; j <= m; j++) ctrl.push([-w / 2 + 9 + (w - 18) * j / (m + 1) + (R() - .5) * 14, Math.max(lo, Math.min(hi, lvl + (R() - .5) * band * 1.8))]);
          ctrl.push(ext, [w / 2, dDeep]);
          const pts = catmull(ctrl, 6).map(q => surf(B, u0, q[0], q[1]));
          for (const q of pts) { depthAt(q[0], q[1]); if (dD < e1 - 2 || dD > dDeep + 5) { ok = false; break; } }
          paths.push({ p: pts, off: R(), sp: .13 + R() * .08 });
        }
        if (!ok) continue;
        const links = [];
        for (let k = 0; k < n - 1; k++) for (let z = 0; z < 2; z++) if (R() < .6) { const j = 10 + ((R() * (paths[k].p.length - 20)) | 0); links.push([paths[k].p[j], paths[k + 1].p[Math.min(paths[k + 1].p.length - 1, j)], j / paths[k].p.length]); }
        caps.push({ paths: paths, links: links, x: surf(B, u0, 0, 0)[0], dl: 3.5 + R() * 3, art: [surf(B, u0, -w / 2 - 3, dDeep + 9), surf(B, u0, -w / 2, dDeep)], ven: [surf(B, u0, w / 2, dDeep), surf(B, u0, w / 2 + 3, dDeep + 9)], baked: false });
      }
    }
  }
  function pigments() {
    pig = [];
    for (const B of [BT, BB]) { let u = .015 + R() * .03;
      while (u < .97) { const r = R(), ty = r < .47 ? 'mel' : r < .92 ? 'yel' : null; if (ty) pig.push({ p: surf(B, u, 0, 8), ty: ty, rad: 27 + R() * 6 }); u += (58 + R() * 40) / L; } }
  }

  function reset() {
    seed = 4417; build(); pigments(); seed = 20261124; cells = []; t = 0; done = false; doneT = 0; divisions = 0; statNext = 0; acc = 0;
    locF = new Array(NB).fill(0); leaveT = new Array(NX).fill(null);
    for (let x = X0 + R0; x < X0 + PZW + 12; x += R0 * 1.9) { const u = uOf(x);
      for (let y = top(u) + R0; y <= bot(u) - R0; y += R0 * 1.9) cells.push(mk(x + (R() - .5) * 3, y + (R() - .5) * 3, R0 * (1 + R() * .35), R() * .8)); }
    clearLayers();
  }

  // ----- simulation -----
  function mob(c) { if (!c.q) return 1; if (!c.fate) return .03; if (c.fate === 'E') return .35; if (c.fate === 'B' && c.set > .9) return .2; return 1; }
  function relax() {
    const n = Math.min(cells.length, MAXC), its = done && t - doneT > 20 ? 2 : 4;
    for (let i = 0; i < n; i++) { const c = cells[i]; px[i] = c.x; py[i] = c.y; pr[i] = c.r; pm[i] = mob(c); }
    for (let it = 0; it < its; it++) {
      head.fill(-1);
      for (let i = n - 1; i >= 0; i--) { const gx = gcx[i] = (px[i] / G) | 0, gy = gcy[i] = (py[i] / G) | 0, k = gx * GH + gy; next[i] = head[k]; head[k] = i; }
      for (let i = 0; i < n; i++) {
        const gx = gcx[i], gy = gcy[i], ri = pr[i], ma = pm[i];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          for (let j = head[(gx + dx) * GH + gy + dy]; j >= 0; j = next[j]) {
            if (j <= i) continue;
            let ex = px[j] - px[i], ey = py[j] - py[i]; const m = (ri + pr[j]) * .94; let d2 = ex * ex + ey * ey;
            if (d2 >= m * m) continue;
            let d = Math.sqrt(d2); if (d < 1e-4) { ex = 1; ey = 0; d = 1; }
            const mc = pm[j], s = (m - d) / d / (ma + mc) * .5;
            px[i] -= ex * s * ma; py[i] -= ey * s * ma; px[j] += ex * s * mc; py[j] += ey * s * mc;
          }
        }
      }
      for (let i = 0; i < n; i++) { // keep every cell inside the beak
        const r = pr[i], xm = X0 + uMax(r) * L; let x = px[i]; if (x > xm) x = xm; if (x < X0 + r) x = X0 + r; px[i] = x;
        const u = uOf(x), yb = bot(u), yt = yb - thick(u); py[i] = Math.min(yb - r, Math.max(yt + r, py[i]));
      }
    }
    for (let i = 0; i < n; i++) { cells[i].x = px[i]; cells[i].y = py[i]; }
  }

  function bandOf(c) { const u = uOf(c.x), v = (c.y - top(u)) / Math.max(1, thick(u)); return Math.max(0, Math.min(NB - 1, (v * NB) | 0)); }
  function step(dt) {
    t += dt;
    if (!done) {
      const lf = new Array(NB).fill(0);
      for (const c of cells) { if (c.q) continue; const b = bandOf(c); if (c.x + c.r > lf[b]) lf[b] = c.x + c.r; }
      let mx = 0, sum = 0; for (let b = 0; b < NB; b++) { locF[b] = Math.max(lf[b], locF[b]); mx = Math.max(mx, locF[b]); sum += locF[b]; }
      const trail = sum / NB - PZW;
      for (let i = 0; i < NX; i++) if (leaveT[i] === null && X0 + i * 8 < trail) leaveT[i] = t;
      if (mx >= X0 + uMax(R0) * L - 4 || t > 90) { done = true; doneT = t; for (let i = 0; i < NX; i++) if (leaveT[i] === null) leaveT[i] = t; }
    }
    const born = [];
    for (const c of cells) {
      if (!c.q && c.ph < 1 - MIT && (done || c.x < locF[bandOf(c)] - PZW)) { c.q = true; c.qT = t; c.diffT = t + 1.5 + R() * 2.5; }
      if (!c.q || c.ph >= 1 - MIT) {
        const b4 = c.ph; c.ph += dt / c.len;
        if (b4 < 1 - MIT && c.ph >= 1 - MIT) { const a = (R() - .5) * Math.PI * .9 + (R() < .5 ? 0 : Math.PI); c.ax = Math.cos(a); c.ay = Math.sin(a); }
        if (c.ph < 1 - MIT) c.r = R0 * (1 + .414 * (c.ph / (1 - MIT)));
        if (c.ph >= 1) {
          const rd = c.r / Math.SQRT2, d = mk(c.x + c.ax * rd, c.y + c.ay * rd, rd, R() * .08);
          c.x -= c.ax * rd; c.y -= c.ay * rd; c.r = rd; c.ph = R() * .08; c.len = CYCLE * (.85 + .3 * R());
          if (c.q) { c.ph = 0; d.q = true; d.qT = c.qT; d.diffT = c.diffT + R(); }
          born.push(d); divisions++;
        }
        continue;
      }
      if (!c.fate && t >= c.diffT) assignFate(c);
      if (c.fate) differentiate(c, dt);
    }
    for (const d of born) if (cells.length < MAXC) cells.push(d);
    relax();
  }
  function assignFate(c) {
    depthAt(c.x, c.y); bands(uOf(c.x));
    const fd = Math.max(0, dD + (R() - .5) * 26);
    c.dep = dD; c.nx = dNx; c.ny = dNy; c.fs = t; c.ph2 = R() * 6.3; c.hd = R() * 6.3; c.set = 0; c.oa = R() * 6.3;
    c.fate = fd < bE ? 'E' : fd < bV ? 'V' : fd < bD ? 'D' : 'B';
    if (c.fate === 'E') {
      const pc = pig.find(q => Math.hypot(q.p[0] - c.x, q.p[1] - c.y) < q.rad); c.sub = pc ? pc.ty : R() < .24 ? 'sen' : 'E';
      c.dA = []; for (let k = 0; k < 5; k++) c.dA.push((R() - .5) * 2.4); c.tr = R0 * 1.02;
    } else c.tr = c.fate === 'V' ? R0 * .92 : c.fate === 'D' ? R0 * .76 : R0 * .84;
    c.kind = c.fate === 'E' ? c.sub : c.fate; c.settleT = t + 7 + R() * 4;
  }
  function differentiate(c, dt) {
    if ((tick + ((c.ph2 * 10) | 0)) % 3 === 0) { depthAt(c.x, c.y); c.dep = dD; c.nx = dNx; c.ny = dNy; }
    c.r += (c.tr - c.r) * Math.min(1, dt * .6);
    bands(uOf(c.x)); let lo, hi;
    if (c.fate === 'E') { lo = c.r * .85; hi = c.r * 1.15; }
    else if (c.fate === 'V') { lo = bE + c.r * .6; hi = Math.max(lo, bV - c.r * .4); }
    else if (c.fate === 'D') { lo = bV + c.r * .5; hi = Math.max(lo, bD - c.r * .3); }
    else { lo = bD + c.r * .8; hi = 1e9; }
    const g = Math.min(1, (t - c.fs) / 3);
    if (c.dep < lo) { const m = Math.min(1.2, (lo - c.dep) * .06) * g; c.x += c.nx * m; c.y += c.ny * m; }
    else if (c.dep > hi) { const m = Math.min(1.2, (c.dep - hi) * .06) * g; c.x -= c.nx * m; c.y -= c.ny * m; }
    if (c.fate === 'D' || c.fate === 'B') { // amoeboid crawling
      if (c.fate === 'B') c.set = Math.min(1, Math.max(0, (t - c.settleT) / 3));
      const v = (c.fate === 'D' ? 26 : 7) * (1 - c.set) * g;
      c.hd += (R() - .5) * (c.fate === 'D' ? .7 : .35);
      if (v) { c.x += Math.cos(c.hd) * v * dt; c.y += Math.sin(c.hd) * v * dt; }
      if (c.dep < lo + 1 || c.dep > hi - 1) { const s = c.dep < lo + 1 ? 1 : -1, into = Math.atan2(s * c.ny, s * c.nx); c.hd += Math.sin(into - c.hd) * .15; }
    }
  }

  // ----- layers and sizing -----
  function outline(g) { g.beginPath(); for (let i = 0; i < NS; i += 2) i ? g.lineTo(BT[i][0], BT[i][1]) : g.moveTo(BT[i][0], BT[i][1]); for (let i = NS - 1; i >= 0; i -= 2) g.lineTo(BB[i][0], BB[i][1]); g.closePath(); }
  function base(g) { g.setTransform(scale, 0, 0, scale, 0, offY * scale); }
  function clearLayers() {
    if (!cv.width) return;
    uctx.globalAlpha = 1; uctx.setTransform(1, 0, 0, 1, 0, 0); uctx.fillStyle = '#000'; uctx.fillRect(0, 0, under.width, under.height);
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, over.width, over.height);
    for (const g of [uctx, octx]) { base(g); g.lineCap = 'round'; g.lineJoin = 'round'; }
    // final beak outline, faint, so you can see where it is heading
    outline(uctx); uctx.fillStyle = '#0b0b0c'; uctx.fill(); uctx.lineCap = 'butt'; uctx.strokeStyle = '#5a5c60'; uctx.lineWidth = 1.5; uctx.setLineDash([5, 6]); uctx.stroke(); uctx.setLineDash([]);
    uctx.strokeStyle = '#3a3c40'; uctx.lineWidth = 6; uctx.beginPath(); uctx.moveTo(X0 - 4, top(0) - 6); uctx.lineTo(X0 - 4, bot(0) + 6); uctx.stroke(); uctx.lineCap = 'round';
    if (fibD) { for (const l of [fibB, fibD, caps]) for (const o of l) o.baked = false; }
  }
  function boneSprite() { // one settled osteocyte, drawn rotated for each settled bone cell
    const r = R0 * .84, ea = 1.3 * r, eb = .68 * r; boneHalf = Math.ceil(2.9 * r);
    bone.width = bone.height = Math.max(8, Math.ceil(boneHalf * 2 * scale)); const g = bone.getContext('2d'), k = bone.width / (boneHalf * 2);
    g.setTransform(k, 0, 0, k, bone.width / 2, bone.height / 2);
    g.beginPath(); g.ellipse(0, 0, ea, eb, 0, 0, TAU); g.fillStyle = PAL.B[FADE].body; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.15; g.stroke();
    g.strokeStyle = 'rgba(200,200,200,.8)'; g.lineWidth = .9; g.beginPath();
    for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + (j % 2 ? .35 : -.2), d0 = j % 3 === 0 ? ea : eb * 1.1, d1 = d0 + r * 1.5; g.moveTo(Math.cos(a) * d0, Math.sin(a) * d0); g.lineTo(Math.cos(a) * d1, Math.sin(a) * d1); } g.stroke();
    g.beginPath(); g.arc(0, 0, r * .32, 0, TAU); g.fillStyle = PAL.B[FADE].nuc; g.fill();
  }
  function resize() {
    const cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
    const dpr = Math.min(DPRS[tier], window.devicePixelRatio || 1), w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (cv.width === w && cv.height === h && cssW) return;
    cssW = cw; for (const c of [cv, under, over]) { c.width = w; c.height = h; }
    scale = w / W; viewH = h / scale; offY = viewH > 640 ? 24 : 0; // extra height on phones makes room for larger labels
    boneSprite(); clearLayers(); draw();
  }

  // ----- drawing -----
  function ramp(x, dl, dur) { const lt = leaveT[xb(x)]; if (lt === null) return 0; return Math.max(0, Math.min(1, (t - lt - dl) / dur)); }
  function bakeFibers(list, color, w) { // move fully grown fibers into the static layer
    let any = false;
    for (const F of list) {
      if (F.baked || ramp(F.x, F.dl, 3) < 1) continue;
      if (!any) { any = true; uctx.strokeStyle = color; uctx.lineWidth = w; uctx.beginPath(); }
      uctx.moveTo(F.p0[0], F.p0[1]); uctx.quadraticCurveTo(F.p1[0], F.p1[1], F.p2[0], F.p2[1]); F.baked = true;
    }
    if (any) uctx.stroke();
  }
  function growFibers(list, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    for (const F of list) {
      if (F.baked) continue;
      const a = ramp(F.x, F.dl, 3); if (a <= 0) continue;
      // the first part of a quadratic curve is itself a quadratic curve
      const i = 1 - a, mx = i * F.p0[0] + a * F.p1[0], my = i * F.p0[1] + a * F.p1[1], ex = i * i * F.p0[0] + 2 * i * a * F.p1[0] + a * a * F.p2[0], ey = i * i * F.p0[1] + 2 * i * a * F.p1[1] + a * a * F.p2[1];
      ctx.globalAlpha = Math.min(1, a * 1.4); ctx.beginPath(); ctx.moveTo(F.p0[0], F.p0[1]); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function bed(g, V, a) {
    const segs = []; for (let b = 0; b < NBK; b++) segs.push([]);
    for (const P of V.paths) { const n = P.p.length - 1, m = Math.max(1, Math.round(n * a)); for (let k = 0; k < m; k++) segs[Math.min(NBK - 1, (k / n * NBK) | 0)].push(P.p[k], P.p[k + 1]); }
    if (a >= 1) for (const l of V.links) segs[Math.min(NBK - 1, (l[2] * NBK) | 0)].push(l[0], l[1]);
    for (const pass of [[4.5, .22], [1.6, 1]]) for (let b = 0; b < NBK; b++) {
      const S = segs[b]; if (!S.length) continue; const c = BLOOD[b];
      g.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + pass[1] + ')'; g.lineWidth = pass[0]; g.beginPath();
      for (let i = 0; i < S.length; i += 2) { g.moveTo(S[i][0], S[i][1]); g.lineTo(S[i + 1][0], S[i + 1][1]); } g.stroke();
    }
    // feeding arteriole (bright red) and draining venule (blue), thicker
    g.globalAlpha = Math.min(1, a * 2); g.lineWidth = 3; g.strokeStyle = rgb(OXY); g.beginPath(); g.moveTo(V.art[0][0], V.art[0][1]); g.lineTo(V.art[1][0], V.art[1][1]); g.stroke();
    if (a >= 1) { g.strokeStyle = rgb(DEOXY); g.beginPath(); g.moveTo(V.ven[0][0], V.ven[0][1]); g.lineTo(V.ven[1][0], V.ven[1][1]); g.stroke(); }
    g.globalAlpha = 1;
  }
  const DOTC = []; for (let b = 0; b < NBK; b++) DOTC.push(rgb(mix([255, 120, 110], [140, 160, 255], b / (NBK - 1))));
  function drawCaps() {
    const live = []; let flow = false;
    for (const V of caps) { if (V.baked) { flow = true; continue; } const a = ramp(V.x, V.dl, 4); if (a <= 0) continue; if (a >= 1) { octx.save(); outline(octx); octx.clip(); bed(octx, V, 1); octx.restore(); V.baked = true; flow = true; } else live.push(V, a); }
    if (flow) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(over, 0, 0); base(ctx); }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let i = 0; i < live.length; i += 2) bed(ctx, live[i], live[i + 1]);
    if (!flow) return;
    // red blood cells flowing through, giving up oxygen as they go
    const dots = []; for (let b = 0; b < NBK; b++) dots.push([]);
    for (const V of caps) { if (!V.baked) continue; for (const P of V.paths) { const n = P.p.length - 1; for (let q = 0; q < 3; q++) { const pp = (t * P.sp + P.off + q / 3) % 1, f = pp * n, i = f | 0, r = f - i, A = P.p[i], B = P.p[Math.min(n, i + 1)]; dots[Math.min(NBK - 1, (pp * NBK) | 0)].push(A[0] + (B[0] - A[0]) * r, A[1] + (B[1] - A[1]) * r); } } }
    for (let b = 0; b < NBK; b++) { const D = dots[b]; if (!D.length) continue; ctx.fillStyle = DOTC[b]; ctx.beginPath(); for (let i = 0; i < D.length; i += 2) { ctx.moveTo(D[i] + 1.5, D[i + 1]); ctx.arc(D[i], D[i + 1], 1.5, 0, TAU); } ctx.fill(); }
  }

  const fadeOf = c => c.fate ? Math.min(1, (t - c.fs) / 2.5) : 0;
  // amoeboid outline that eases into an ellipse as the cell settles
  function blobPath(c, f) {
    const s = c.set, m = (1 - s) * Math.min(1, f * 1.5), r = c.r, ea = 1.3 * r, eb = .68 * r, D = c.fate === 'D', spd = D ? 2.2 : 1, pa = (D ? .8 : .55) * m * (.75 + .25 * Math.sin(t * 3 * spd + c.ph2));
    const x3 = c.ph2 + t * 1.8 * spd, x5 = -c.ph2 - t * 2.6 * spd, S3 = Math.sin(x3), C3 = Math.cos(x3), S5 = Math.sin(x5), C5 = Math.cos(x5), ch = Math.cos(c.hd), sh = Math.sin(c.hd), co = Math.cos(c.oa), so = Math.sin(c.oa);
    for (let k = 0; k < NP; k++) {
      const d = cA[k] * ch + sA[k] * sh, d2 = d * d;
      let q = r * (1 + .2 * m * (s3[k] * C3 + c3[k] * S3) + .12 * m * (s5[k] * C5 + c5[k] * S5) + (d > 0 ? pa * d2 * d2 : -.15 * m * d2));
      if (s > 0) { const cd = cA[k] * co + sA[k] * so, sd = sA[k] * co - cA[k] * so, el = ea * eb / Math.sqrt(eb * eb * cd * cd + ea * ea * sd * sd); q = q * (1 - s) + el * s; }
      bxs[k] = c.x + cA[k] * q; bys[k] = c.y + sA[k] * q;
    }
    ctx.moveTo((bxs[0] + bxs[NP - 1]) / 2, (bys[0] + bys[NP - 1]) / 2);
    for (let k = 0; k < NP; k++) { const n = k + 1 < NP ? k + 1 : 0; ctx.quadraticCurveTo(bxs[k], bys[k], (bxs[k] + bxs[n]) / 2, (bys[k] + bys[n]) / 2); }
    ctx.closePath();
  }
  function cellPath(c, f) {
    if (c.fate === 'E') { const ang = Math.atan2(c.ny, c.nx) + Math.PI / 2, a = c.r * (1 + .32 * f); ctx.moveTo(c.x + Math.cos(ang) * a, c.y + Math.sin(ang) * a); ctx.ellipse(c.x, c.y, a, c.r * (1 - .28 * f), ang, 0, TAU); }
    else if (c.fate === 'D' || c.fate === 'B') blobPath(c, f);
    else { ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, TAU); }
  }
  // draw a group of same-coloured cells with one fill and one stroke
  function batch(kind, lvl, list) {
    const P = PAL[kind][lvl], f = lvl / FADE, nr = kind === 'pz' || kind === 'V' ? .34 : kind === 'D' || kind === 'B' ? .32 : .3;
    ctx.beginPath(); for (const c of list) cellPath(c, f);
    ctx.fillStyle = P.body; ctx.fill(); ctx.lineWidth = 1.15; ctx.strokeStyle = kind === 'mel' && f > .5 ? '#4d4d4d' : '#000'; ctx.stroke();
    if (kind === 'mel' && f > 0) { for (const c of list) shine(c, f); return; }
    ctx.beginPath(); for (const c of list) { const r = c.r * nr; ctx.moveTo(c.x + r, c.y); ctx.arc(c.x, c.y, r, 0, TAU); } ctx.fillStyle = P.nuc; ctx.fill();
  }
  function shine(c, f) { // glossy highlight on black pigment cells
    const ang = Math.atan2(c.ny, c.nx) + Math.PI / 2, a = c.r * (1 + .32 * f), hx = c.x - Math.cos(ang) * a * .3 - Math.sin(ang) * c.r * .3, hy = c.y - Math.sin(ang) * a * .3 - c.r * .3, g = ctx.createRadialGradient(hx, hy, 0, hx, hy, a * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,' + .75 * f + ')'); g.addColorStop(.3, 'rgba(200,200,205,' + .28 * f + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); cellPath(c, f); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(190,190,195,' + .5 * f + ')'; ctx.lineWidth = .8; ctx.stroke();
  }
  function dividing(c) { // pinches into two
    const p = (c.ph - (1 - MIT)) / MIT, rd = c.r / Math.SQRT2, rr = c.r + (rd - c.r) * p, off = rd * p, dx = c.ax * off, dy = c.ay * off, no = Math.max(off, rr * .45 * Math.min(1, p * 2));
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, rr + 1.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(c.x - dx, c.y - dy, rr + 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.pz[0].body; ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, rr, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(c.x - dx, c.y - dy, rr, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.pz[0].nuc; for (let s = -1; s < 2; s += 2) { ctx.beginPath(); ctx.arc(c.x + s * c.ax * no, c.y + s * c.ay * no, rr * .28, 0, TAU); ctx.fill(); }
  }
  function spikes(list) { // canaliculi sprouting from settling bone cells
    for (const c of list) { const s = c.set; if (s <= 0) continue; const r = c.r, ea = 1.3 * r, eb = .68 * r; ctx.strokeStyle = 'rgba(200,200,200,' + .8 * s + ')'; ctx.lineWidth = .9; ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = c.oa + k * Math.PI / 3 + (k % 2 ? .35 : -.2), d0 = k % 3 === 0 ? ea : eb * 1.1, d1 = d0 + r * (.6 + .9 * s), x = Math.cos(a), y = Math.sin(a); ctx.moveTo(c.x + x * d0, c.y + y * d0); ctx.lineTo(c.x + x * d1, c.y + y * d1); } ctx.stroke(); }
  }
  const ORDER = ['B', 'D', 'V', 'pz', 'E', 'sen', 'yel', 'mel'], groups = {};
  ORDER.forEach(k => { groups[k] = []; for (let i = 0; i <= FADE; i++) groups[k].push([]); });
  const settled = [], splitting = [], neurons = [];
  function drawCells() {
    for (const k of ORDER) for (const g of groups[k]) g.length = 0;
    settled.length = splitting.length = neurons.length = 0;
    for (const c of cells) {
      if (c.sub === 'sen') neurons.push(c);
      if (c.fate === 'B' && c.set >= 1) settled.push(c);
      else if (!c.fate && c.ph >= 1 - MIT) splitting.push(c);
      else groups[c.kind][Math.round(fadeOf(c) * FADE)].push(c);
    }
    for (const c of settled) { const k = c.r / (R0 * .84) * scale, co = Math.cos(c.oa) * k, si = Math.sin(c.oa) * k; ctx.setTransform(co, si, -si, co, c.x * scale, (c.y + offY) * scale); ctx.drawImage(bone, -boneHalf, -boneHalf, boneHalf * 2, boneHalf * 2); }
    base(ctx);
    for (const k of ORDER) {
      for (let i = 0; i <= FADE; i++) { const g = groups[k][i]; if (!g.length) continue; batch(k, i, g); if (k === 'B') spikes(g); }
      if (k === 'pz') for (const c of splitting) dividing(c);
    }
  }
  function dendrites(c) {
    const f = Math.min(1, Math.max(0, (t - c.fs - 1) / 4)); if (f <= 0) return;
    const inA = Math.atan2(c.ny, c.nx), outA = inA + Math.PI; ctx.lineCap = 'round'; ctx.strokeStyle = '#b4b8be';
    // axon: one thicker process running inward, ending in a small branch
    const AL = 14 + 34 * f, ca = Math.cos(inA), sa = Math.sin(inA), qx = -sa, qy = ca, wob = c.dA[0] * 3, ax = [];
    for (let k = 0; k <= 10; k++) { const s = k / 10, d = c.r * .6 + AL * s, o = Math.sin(s * Math.PI * 1.5) * wob * s; ax.push([c.x + ca * d + qx * o, c.y + sa * d + qy * o]); }
    for (let k = 0; k < 10; k++) { ctx.lineWidth = 3 - 1.6 * k / 10; ctx.beginPath(); ctx.moveTo(ax[k][0], ax[k][1]); ctx.lineTo(ax[k + 1][0], ax[k + 1][1]); ctx.stroke(); }
    if (f > .6) {
      const e = ax[10], g = (f - .6) / .4, bl = 7 * g; ctx.lineWidth = 1.1; ctx.beginPath();
      for (const s of [-.7, 0, .75]) { const ba = inA + s + wob * .03, mx = e[0] + Math.cos(ba) * bl, my = e[1] + Math.sin(ba) * bl; ctx.moveTo(e[0], e[1]); ctx.lineTo(mx, my); ctx.lineTo(mx + Math.cos(ba + .5) * bl * .45, my + Math.sin(ba + .5) * bl * .45); } ctx.stroke();
      ctx.fillStyle = '#c8ccd2'; ctx.beginPath(); ctx.arc(e[0], e[1], 1.6, 0, TAU); ctx.fill();
    }
    // dendrites: spiky, fanning out towards the beak surface between neighbouring cells
    c.dA.forEach((o, k) => {
      const a = outA + o * .75, len = c.r * (.9 + 1.1 * f) * (k % 2 ? .8 : 1), co = Math.cos(a), si = Math.sin(a), x1 = c.x + co * c.r * .6, y1 = c.y + si * c.r * .6, x2 = x1 + co * len, y2 = y1 + si * len;
      ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2); ctx.stroke();
      ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo((x1 + x2) / 2, (y1 + y2) / 2); ctx.lineTo(x2, y2);
      for (const s of [-.6, .6]) { ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.cos(a + s) * c.r * .5 * f, y2 + Math.sin(a + s) * c.r * .5 * f); } ctx.stroke();
    });
  }
  const FONT = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
  function drawLabels() {
    const u1 = W / cssW, narrow = cssW < 640, fs = Math.max(15, 12 * u1), lw = Math.max(1.2, u1); // never smaller than 12 CSS px
    ctx.textBaseline = 'alphabetic'; ctx.font = '600 ' + fs + 'px ' + FONT; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(X0 - 18, (top(0) + bot(0)) / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#9a9da3'; ctx.fillText(narrow ? 'Face' : 'Attachment to the face', 0, 0); ctx.restore();
    if (!done) {
      const half = ctx.measureText('Progress zone').width / 2 + 10, arrow = fs * 1.05, fx = Math.min(Math.max(locF.reduce((a, b) => a + b, 0) / NB - PZW / 2, X0 + half), X1 - half), ty = Math.max(24 - offY + fs * .5, top(uOf(fx)) - 30 - arrow), ay = ty + arrow;
      ctx.fillStyle = ctx.strokeStyle = '#ecebe8'; ctx.fillText('Progress zone', fx, ty); ctx.lineWidth = lw * 1.6; const k = fs / 15;
      ctx.beginPath(); ctx.moveTo(fx - 44 * k, ay); ctx.lineTo(fx + 40 * k, ay); ctx.stroke(); ctx.beginPath(); ctx.moveTo(fx + 50 * k, ay); ctx.lineTo(fx + 38 * k, ay - 6 * k); ctx.lineTo(fx + 38 * k, ay + 6 * k); ctx.fill();
    }
    const xs = narrow ? [180, 380, 570, 740] : [190, 345, 510, 670], names = ['Epithelium', 'Vascular layer', 'Dermis', 'Bone'];
    for (let k = 0; k < 4; k++) {
      const x = xs[k], a = ramp(x, 9, 2); if (a <= 0) continue;
      const u = uOf(x); bands(u); const dd = [bE * .5, (bE + bV) / 2, (bV + bD) / 2, bD + 28][k], yp = bot(u) - dd, yt = narrow ? 520 + fs * 1.5 * (k % 2) : 520;
      ctx.globalAlpha = a; ctx.strokeStyle = ctx.fillStyle = '#ecebe8'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, yt - fs * 1.15); ctx.lineTo(x, yp); ctx.stroke(); ctx.beginPath(); ctx.arc(x, yp, 2.2 * lw, 0, TAU); ctx.fill(); ctx.fillText(names[k], x, yt);
    }
    ctx.globalAlpha = 1;
  }
  function draw() {
    if (!cssW) return;
    bakeFibers(fibB, '#a47c45', 1.4); bakeFibers(fibD, '#e2c995', 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(under, 0, 0); base(ctx);
    ctx.save(); outline(ctx); ctx.clip();
    if (zoneOn.checked && !done) {
      const h = 1 / NB, zx = b => (locF[Math.max(0, b - 1)] + 2 * locF[b] + locF[Math.min(NB - 1, b + 1)]) / 4 - PZW;
      ctx.beginPath(); for (let b = 0; b < NB; b++) { const x = zx(b), u = uOf(x), y = top(u) + thick(u) * (b + .5) * h; b ? ctx.lineTo(x, y) : ctx.moveTo(x, y - 200); }
      ctx.lineTo(zx(NB - 1), H); ctx.lineTo(W, H); ctx.lineTo(W, 0); ctx.lineTo(zx(0), 0); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
    }
    ctx.lineCap = 'round'; growFibers(fibB, '#a47c45', 1.4); growFibers(fibD, '#e2c995', 1);
    drawCells(); drawCaps();
    for (const c of neurons) dendrites(c);
    ctx.restore();
    if (labelsOn.checked) drawLabels();
    const now = performance.now();
    if (now > statNext) { statNext = now + 250; const s = (!done ? 'Progress zone dividing' : t - doneT < 14 ? 'Cells sorting into layers' : 'Layers formed') + ' · ' + cells.length + ' cells · ' + divisions + ' divisions'; if (stat.textContent !== s) stat.textContent = s; }
  }

  // ----- main loop: runs only while playing and on screen -----
  let visible = true, raf = 0, last = 0, acc = 0, slowSum = 0, slowN = 0;
  function frame(now) {
    raf = 0; const raw = now - last; last = now;
    acc += Math.min(.1, Math.max(0, raw / 1000)) * speed;
    const stop = performance.now() + 12;
    while (acc >= STEP) { tick++; step(STEP); acc -= STEP; if (performance.now() > stop) { acc = 0; break; } } // slow device: run slower, never freeze
    draw();
    // sustained under 25 fps: lower the resolution one notch
    if (raw > 0 && raw < 400) { slowSum += raw; if (++slowN >= 45) { if (slowSum / slowN > 40 && tier < DPRS.length - 1) { tier++; while (tier < DPRS.length - 1 && DPRS[tier] >= (window.devicePixelRatio || 1)) tier++; resize(); } slowSum = slowN = 0; } }
    kick();
  }
  function kick() { if (running && visible && !raf) raf = requestAnimationFrame(frame); }
  function wake() { if (running && visible && !raf) { last = performance.now(); slowSum = slowN = 0; kick(); } }
  function setRunning(v) { running = v; playB.textContent = v ? 'Pause' : 'Play'; if (v) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  playB.onclick = () => setRunning(!running);
  $('.fb-restart').onclick = () => { reset(); draw(); setRunning(true); };
  sp.oninput = () => { speed = +sp.value; spv.textContent = speed + '×'; };
  labelsOn.onchange = zoneOn.onchange = () => { if (!raf) draw(); };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  window.addEventListener('resize', resize);
  if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }).observe(cv);
  document.addEventListener('visibilitychange', () => { last = performance.now(); slowSum = slowN = 0; });

  reset(); resize();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) setRunning(false); else wake();
  root.finchBeak = { step: n => { for (let i = 0; i < n; i++) { tick++; step(STEP); } draw(); }, draw: draw, pause: () => setRunning(false), info: () => ({ t: t, cells: cells.length, divisions: divisions, done: done, tier: tier }) };
}

Array.prototype.forEach.call(document.querySelectorAll('[data-interactive="finch-beak"]'), mount);
})();
