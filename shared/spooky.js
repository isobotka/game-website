// The Halloween background behind the games (the picture is in ../img/spooky.svg, the CSS in game.css).
// Loaded in <head> so a player who turned it off never sees it flash on. The choice is remembered
// for every game. The switch is the Spooky button in the banner.
(function () {
  var KEY = 'spooky';
  var root = document.documentElement;

  function isOn() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
  }

  function apply(on) {
    root.classList.toggle('no-spooky', !on);
    var btn = document.getElementById('btnSpooky');
    if (btn) btn.setAttribute('aria-checked', String(on));
  }

  apply(isOn());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btnSpooky');
    if (!btn) return;
    apply(isOn());
    btn.addEventListener('click', function () {
      var on = root.classList.contains('no-spooky');
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      apply(on);
    });
  });
})();
