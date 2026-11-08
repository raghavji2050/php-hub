(function () {
  var menu = document.getElementById('site-menu');
  if (!menu) return;
  var summary = menu.querySelector('summary');
  var panel = document.getElementById('site-menu-panel');
  function setExpanded() {
    if (summary) summary.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
  }
  setExpanded();
  menu.addEventListener('toggle', setExpanded);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      if (summary) summary.focus();
    }
  });
  if (panel) {
    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) menu.open = false;
    });
  }
})();
