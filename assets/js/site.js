/* Light/dark switch. The first paint is handled by the small script in <head>. */
(function () {
  var root = document.documentElement, btn = document.querySelector('.theme'), mq = window.matchMedia('(prefers-color-scheme: dark)');
  function saved() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var label = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode';
    btn.setAttribute('aria-label', label); btn.title = label;
    document.querySelector('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--bg').trim();
  }
  apply(root.getAttribute('data-theme') || 'light');
  btn.onclick = function () { var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('theme', next); } catch (e) {} apply(next); };
  function system() { if (!saved()) apply(mq.matches ? 'dark' : 'light'); }
  if (mq.addEventListener) mq.addEventListener('change', system); else if (mq.addListener) mq.addListener(system);
})();
