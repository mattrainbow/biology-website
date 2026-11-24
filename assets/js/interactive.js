/* Shared runtime for interactives: mounting, fonts from the site tokens, and an
   animation runner that stops off screen and lowers resolution on slow devices. */
window.IX = (function () {
  'use strict';
  const TIERS = [2, 1.5, 1, .75];

  function define(name, mount) { Array.prototype.forEach.call(document.querySelectorAll('[data-interactive="' + name + '"]'), el => { el.innerHTML = ''; mount(el); }); }
  const token = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
  const reducedMotion = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* o.frame(dt, now)  draw one frame; return true to keep animating
     o.resize(w, h, dpr)  set the canvas size and redraw (w, h in CSS pixels) */
  function runner(canvas, o) {
    let raf = 0, last = 0, idle = true, visible = true, dirty = false, tier = 0, sum = 0, n = 0, pw = 0, ph = 0, pd = 0;
    const device = () => window.devicePixelRatio || 1;
    function tick(now) {
      raf = 0; const raw = now - last; last = now;
      if (!idle && raw > 0 && raw < 1000) { // sustained under 25 fps: drop the resolution, further if it is very slow
        sum += raw; n++;
        if (n >= 45 || (sum > 1200 && n > 3)) { if (sum / n > 40) lower(sum / n > 80 ? 2 : 1); sum = n = 0; }
      }
      const more = o.frame(idle ? 0 : Math.min(.1, Math.max(0, raw / 1000)), now);
      idle = !more; if (more) request();
    }
    function lower(steps) {
      const from = Math.min(TIERS[tier], device());
      while (steps-- && tier < TIERS.length - 1) do tier++; while (tier < TIERS.length - 1 && TIERS[tier] >= device());
      if (Math.min(TIERS[tier], device()) < from) measure();
    }
    function request() { if (!visible) { dirty = true; return; } if (!raf) { if (idle) { last = performance.now(); sum = n = 0; } raf = requestAnimationFrame(tick); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; idle = true; }
    function measure() {
      const w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(TIERS[tier], device());
      if (!w || !h || (w === pw && h === ph && d === pd)) return;
      pw = w; ph = h; pd = d; o.resize(w, h, d);
    }
    if (window.ResizeObserver) new ResizeObserver(measure).observe(canvas);
    window.addEventListener('resize', measure);
    if (window.IntersectionObserver) new IntersectionObserver(es => {
      const v = es[es.length - 1].isIntersecting; if (v === visible) return;
      if (!v) { dirty = raf > 0 || dirty; stop(); visible = false; } else { visible = true; if (dirty) { dirty = false; request(); } }
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => { last = performance.now(); sum = n = 0; });
    return { request: request, stop: stop, measure: measure, tier: () => tier };
  }
  return { define: define, token: token, reducedMotion: reducedMotion, runner: runner };
})();
