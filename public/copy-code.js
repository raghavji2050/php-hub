// Adds a Copy button to every code block in posts. External file: CSP script-src 'self'.
(function () {
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); } finally { t.remove(); }
    });
  }
  function init() {
    document.querySelectorAll('.prose pre').forEach(function (pre) {
      if (pre.parentElement.classList.contains('code-wrap')) return;
      var wrap = document.createElement('div'); wrap.className = 'code-wrap';
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'copy-btn'; b.textContent = 'Copy'; b.setAttribute('aria-label', 'Copy code to clipboard');
      b.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        copy(code.innerText).then(function () { b.textContent = 'Copied!'; }, function () { b.textContent = 'Failed'; })
          .then(function () { setTimeout(function () { b.textContent = 'Copy'; }, 1800); });
      });
      wrap.appendChild(b);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
