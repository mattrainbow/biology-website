/* A small WebGL 1 renderer: lit cylinders and spheres for bones, plus one flat translucent skin.
   Replaces a 600 KB 3D library with about 8 KB. */
window.LimbRenderer = function (canvas, bg) {
  'use strict';
  const opt = { alpha: true, antialias: true, depth: true, powerPreference: 'low-power' };
  let gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt);
  if (!gl) return null;
  const lin = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255].map(v => Math.pow(v / 255, 2.2)); };
  const back = lin(bg);

  const VS = 'attribute vec3 p;attribute vec3 n;uniform mat3 R;uniform vec4 M;uniform vec3 S;uniform vec3 C;uniform vec4 P;uniform vec2 Z;varying vec3 vn;' +
    // M = centre x, y and long-axis direction x, y; S = scale across, along, deep; C = camera target x, y and bone depth; P = projection; Z = depth range
    'vec3 turn(vec3 v){return vec3(v.x*M.w+v.y*M.z,-v.x*M.z+v.y*M.w,v.z);}' +
    'void main(){vec3 q=R*(turn(p*S)+vec3(M.xy-C.xy,C.z));vn=R*turn(n/S);float d=P.w-q.z;gl_Position=vec4(q.x*P.x,q.y*P.y,Z.x*d+Z.y,d);}';
  const FS = 'precision mediump float;varying vec3 vn;uniform vec4 K;uniform float flat_;' +
    'void main(){vec3 n=normalize(vn);if(flat_>.5&&n.z<0.)n=-n;' +
    'vec3 key=vec3(.327,.524,.786),rim=vec3(-.520,-.347,-.780);float kd=max(dot(n,key),0.);' +
    'vec3 l=.85*mix(vec3(.042,.058,.080),vec3(1.),.5+.5*n.y)+vec3(.95*kd)+.45*vec3(.521,.658,1.)*max(dot(n,rim),0.);' +
    'float h=max(dot(n,vec3(.173,.277,.945)),0.),g=h*h*-.9375+1.;float s=flat_>.5?0.:kd*.0008/(g*g);' +
    'gl_FragColor=vec4(pow(K.rgb*l+s,vec3(.4545)),K.a);}';

  let U, buf, shapes, skinBuf, skinPts, skinTri;
  function shader(type, text) { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); return s; }
  function shape(v, idx) {
    const a = gl.createBuffer(), b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, a); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { a: a, b: b, n: idx.length };
  }
  function tube(seg, low, caps) { // unit cylinder along y; "low" is the radius at the bottom
    const v = [], ix = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); v.push(c, .5, s, c, 0, s, c * low, -.5, s * low, c, 0, s); if (i < seg) { const k = i * 2; ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    if (caps) for (const y of [.5, -.5]) { const o = v.length / 6, r = y > 0 ? 1 : low; v.push(0, y, 0, 0, y, 0); for (let i = 0; i <= seg; i++) { const t = i / seg * Math.PI * 2; v.push(Math.cos(t) * r, y, Math.sin(t) * r, 0, y, 0); if (i < seg) ix.push(o, o + 1 + i, o + 2 + i); } }
    return shape(v, ix);
  }
  function ball(seg, rows) {
    const v = [], ix = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) { const a = j / rows * Math.PI, t = i / seg * Math.PI * 2, x = Math.sin(a) * Math.cos(t), y = Math.cos(a), z = Math.sin(a) * Math.sin(t); v.push(x, y, z, x, y, z); if (j < rows && i < seg) { const k = j * (seg + 1) + i; ix.push(k, k + 1, k + seg + 1, k + 1, k + seg + 2, k + seg + 1); } }
    return shape(v, ix);
  }
  // ear clipping: cut the outline into triangles
  function triangulate(P) {
    const V = P.map((q, i) => i), out = []; let area = 0;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) area += P[j][0] * P[i][1] - P[i][0] * P[j][1];
    if (area < 0) V.reverse();
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let i = 0, misses = 0;
    while (V.length > 2) {
      const n = V.length; i %= n; const ia = V[(i + n - 1) % n], ib = V[i], ic = V[(i + 1) % n], a = P[ia], b = P[ib], c = P[ic], k = cross(a, b, c);
      let ear = k > 0;
      for (let j = 0; ear && j < n; j++) { const v = V[j]; if (v === ia || v === ib || v === ic) continue; const q = P[v]; if (cross(a, b, q) > 0 && cross(b, c, q) > 0 && cross(c, a, q) > 0) ear = false; }
      if (ear || k === 0 || misses > n) { if (k > 0) out.push(a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0); V.splice(i, 1); misses = 0; } else { i++; misses++; }
    }
    return new Float32Array(out);
  }
  function init() {
    const pr = gl.createProgram(); gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(pr, 0, 'p'); gl.bindAttribLocation(pr, 1, 'n'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { if (gl.isContextLost()) return; throw new Error(gl.getProgramInfoLog(pr) || 'shader link failed'); }
    gl.useProgram(pr);
    U = {}; ['R', 'M', 'S', 'C', 'P', 'Z', 'K', 'flat_'].forEach(k => { U[k] = gl.getUniformLocation(pr, k); });
    shapes = { tube: tube(16, 1, false), ball: ball(18, 12), hoof: tube(22, .62, true) }; skinBuf = gl.createBuffer(); buf = skinPts = null;
    gl.enableVertexAttribArray(0); gl.clearColor(Math.pow(back[0], 1 / 2.2), Math.pow(back[1], 1 / 2.2), Math.pow(back[2], 1 / 2.2), 1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  function use(s) {
    if (buf === s) return; buf = s;
    gl.bindBuffer(gl.ARRAY_BUFFER, s.a); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, s.b); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  }
  // draw one shape centred at (x, y), its long axis along the unit direction (dx, dy)
  function put(name, x, y, dx, dy, sx, sy, sz) {
    use(shapes[name]); gl.uniform4f(U.M, x, y, dx, dy); gl.uniform3f(U.S, sx, sy, sz); gl.drawElements(gl.TRIANGLES, buf.n, gl.UNSIGNED_SHORT, 0);
  }
  /* view: {rx, ry, cx, cy, dist, tan}   bones: [{a, b, r, col}]   dots: [{x, y, r}] with dotCol
     skin: {pts, color, alpha} or null   hoof: {a, b, alpha} or null */
  function draw(view, bones, dots, dotCol, skin, hoof) {
    if (gl.isContextLost()) return;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, f = 1 / view.tan, cx = Math.cos(view.rx), sx = Math.sin(view.rx), cy = Math.cos(view.ry), sy = Math.sin(view.ry);
    gl.viewport(0, 0, w, h); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix3fv(U.R, false, [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
    gl.uniform3f(U.C, view.cx, view.cy, 0); gl.uniform4f(U.P, f * h / w, f, view.dist, view.dist); gl.uniform1f(U.flat_, 0);
    const near = Math.max(.2, view.dist - 15), far = view.dist + 15; gl.uniform2f(U.Z, (far + near) / (far - near), -2 * far * near / (far - near));
    for (const b of bones) {
      const ex = b.b[0] - b.a[0], ey = b.b[1] - b.a[1], L = Math.hypot(ex, ey); if (L < .02) continue;
      gl.uniform4f(U.K, b.col[0], b.col[1], b.col[2], 1);
      put('tube', (b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, ex / L, ey / L, b.r * .78, L, b.r * .78);
      put('ball', b.a[0], b.a[1], 0, 1, b.r, b.r, b.r); put('ball', b.b[0], b.b[1], 0, 1, b.r * .9, b.r * .9, b.r * .9);
    }
    gl.uniform4f(U.K, dotCol[0], dotCol[1], dotCol[2], 1); for (const d of dots) put('ball', d.x, d.y, 0, 1, d.r, d.r, d.r);
    if (skin) { // a strict depth test paints places where the outline overlaps itself only once
      if (skinPts !== skin.pts) { skinPts = skin.pts; skinTri = triangulate(skin.pts); gl.bindBuffer(gl.ARRAY_BUFFER, skinBuf); gl.bufferData(gl.ARRAY_BUFFER, skinTri, gl.DYNAMIC_DRAW); } else gl.bindBuffer(gl.ARRAY_BUFFER, skinBuf);
      buf = null; gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.disableVertexAttribArray(1); gl.vertexAttrib3f(1, 0, 0, 1);
      gl.uniform4f(U.M, 0, 0, 0, 1); gl.uniform3f(U.S, 1, 1, 1); gl.uniform3f(U.C, view.cx, view.cy, -.01); gl.uniform1f(U.flat_, 1);
      gl.enable(gl.BLEND); gl.uniform4f(U.K, skin.color[0], skin.color[1], skin.color[2], skin.alpha); gl.drawArrays(gl.TRIANGLES, 0, skinTri.length / 3);
      gl.disable(gl.BLEND); gl.uniform3f(U.C, view.cx, view.cy, 0); gl.uniform1f(U.flat_, 0);
    }
    if (hoof) {
      const ex = hoof.b[0] - hoof.a[0], ey = hoof.b[1] - hoof.a[1], L = Math.hypot(ex, ey) || 1, c = lin('#3b3430');
      gl.enable(gl.BLEND); gl.uniform4f(U.K, c[0], c[1], c[2], hoof.alpha);
      put('hoof', hoof.a[0] + ex * .62, hoof.a[1] + ey * .62, ex / L, ey / L, .34, L * 1.25, .34); gl.disable(gl.BLEND);
    }
  }
  init();
  const self = { draw: draw, lin: lin, onrestore: null };
  canvas.addEventListener('webglcontextlost', e => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => { init(); if (self.onrestore) self.onrestore(); });
  return self;
};
