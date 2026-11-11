(function () {
  var key = 'php-hub-theme';
  function stored() {
    try {
      var value = localStorage.getItem(key);
      return value === 'light' || value === 'dark' ? value : '';
    } catch (error) {
      return '';
    }
  }
  function system() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f3ec' : '#141416');
    var button = document.getElementById('theme-toggle');
    if (!button) return;
    var next = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', next === 'light' ? 'Switch to light theme' : 'Switch to dark theme');
    var label = document.getElementById('theme-toggle-label');
    if (label) label.textContent = next === 'light' ? 'Light' : 'Dark';
  }
  apply(stored() || system());
  document.addEventListener('DOMContentLoaded', function () {
    apply(stored() || system());
    var button = document.getElementById('theme-toggle');
    if (button) {
      button.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        var next = current === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, next); } catch (error) {}
        apply(next);
      });
    }
    var query = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function () { if (!stored()) apply(system()); };
    if (query.addEventListener) query.addEventListener('change', onChange);
  });
})();
