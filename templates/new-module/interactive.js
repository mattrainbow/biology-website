IX.define('{{slug}}', function (root) {
  'use strict';
  root.innerHTML =
    '<div class="ix"><div class="ix-stage"><canvas role="img" aria-label="Describe the animation"></canvas></div>' +
    '<div class="ix-row"><button type="button" class="ix-btn">Pause</button></div></div>';
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), button = root.querySelector('button');
  let running = !IX.reducedMotion(), t = 0, dpr = 1;

  function draw() {
    const w = cv.width / dpr, h = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = IX.token(root, '--stage-ink');
    ctx.beginPath(); ctx.arc(w / 2 + Math.sin(t) * w / 4, h / 2, 20, 0, 7); ctx.fill();
  }
  const run = IX.runner(cv, {
    resize: (w, h, d) => { dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); draw(); },
    frame: dt => { t += dt; draw(); return running; }
  });
  button.onclick = () => { running = !running; button.textContent = running ? 'Pause' : 'Play'; run.request(); };
  button.textContent = running ? 'Pause' : 'Play';
  run.measure(); if (running) run.request();

  // used by tools/thumbnails.py and for debugging in the browser console
  root.interactive = { thumbnail: () => { running = false; t = 1; draw(); } };
});
