(function () {
  if (window.__phpHubReading) return;
  window.__phpHubReading = true;
  var bookmarksKey = 'php-hub-bookmarks';
  var historyKey = 'php-hub-history';
  var progressKey = 'php-hub-path-progress';

  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '');
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function safeItem(item) {
    if (!item || typeof item.url !== 'string' || typeof item.title !== 'string') return null;
    if (!item.url.startsWith('/') || item.url.startsWith('//') || item.url.indexOf('\\') !== -1) return null;
    return {
      url: item.url,
      title: item.title.slice(0, 180),
      section: typeof item.section === 'string' ? item.section.slice(0, 40) : '',
      at: typeof item.at === 'string' ? item.at : '',
    };
  }
  function list(key) {
    var value = read(key, []);
    if (!Array.isArray(value)) return [];
    return value.map(safeItem).filter(Boolean);
  }

  document.querySelectorAll('[data-reading]').forEach(function (bar) {
    var item = safeItem({ url: bar.dataset.url, title: bar.dataset.title, section: bar.dataset.section, at: new Date().toISOString() });
    if (!item) return;
    var history = list(historyKey).filter(function (entry) { return entry.url !== item.url; });
    history.unshift(item);
    write(historyKey, history.slice(0, 40));
    var button = bar.querySelector('[data-bookmark]');
    function saved() {
      return list(bookmarksKey).some(function (entry) { return entry.url === item.url; });
    }
    function paint() {
      if (!button) return;
      var on = saved();
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.textContent = on ? 'Saved' : 'Save';
    }
    paint();
    if (button) {
      button.addEventListener('click', function () {
        var entries = list(bookmarksKey).filter(function (entry) { return entry.url !== item.url; });
        if (!saved()) entries.unshift(item);
        write(bookmarksKey, entries.slice(0, 100));
        paint();
      });
    }
  });

  function renderSavedList(node, entries, empty) {
    node.replaceChildren();
    if (!entries.length) {
      var p = document.createElement('p');
      p.textContent = empty;
      node.appendChild(p);
      return;
    }
    var ul = document.createElement('ul');
    entries.forEach(function (entry) {
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = entry.url;
      link.textContent = entry.title;
      li.appendChild(link);
      if (entry.section) {
        var meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = ' · ' + entry.section;
        li.appendChild(meta);
      }
      ul.appendChild(li);
    });
    node.appendChild(ul);
  }

  var savedRoot = document.querySelector('[data-saved-page]');
  if (savedRoot) {
    var bookmarkNode = savedRoot.querySelector('[data-saved-bookmarks]');
    var historyNode = savedRoot.querySelector('[data-saved-history]');
    var progressNode = savedRoot.querySelector('[data-saved-progress]');
    function paintSaved() {
      renderSavedList(bookmarkNode, list(bookmarksKey), 'No bookmarks yet. Save a lesson or article and it will appear on this device.');
      renderSavedList(historyNode, list(historyKey), 'No reading history yet. Open a lesson or article and it will be listed here.');
      progressNode.replaceChildren();
      var manifestNode = document.getElementById('path-manifest');
      var manifest = [];
      try { manifest = JSON.parse(manifestNode ? manifestNode.textContent : '[]'); } catch (error) { manifest = []; }
      var progress = read(progressKey, {});
      if (!manifest.length) {
        progressNode.textContent = 'No learning paths are available.';
        return;
      }
      var ul = document.createElement('ul');
      manifest.forEach(function (path) {
        var done = progress && progress[path.slug] ? Object.keys(progress[path.slug]).filter(function (id) { return progress[path.slug][id]; }).length : 0;
        var li = document.createElement('li');
        var link = document.createElement('a');
        link.href = path.href;
        link.textContent = path.title;
        li.appendChild(link);
        var meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = ' · ' + done + ' of ' + path.total + ' published modules marked on this device';
        li.appendChild(meta);
        ul.appendChild(li);
      });
      progressNode.appendChild(ul);
    }
    paintSaved();
    savedRoot.querySelector('[data-clear="bookmarks"]')?.addEventListener('click', function () {
      if (!confirm('Remove all bookmarks stored in this browser?')) return;
      write(bookmarksKey, []);
      paintSaved();
    });
    savedRoot.querySelector('[data-clear="history"]')?.addEventListener('click', function () {
      if (!confirm('Remove reading history stored in this browser?')) return;
      write(historyKey, []);
      paintSaved();
    });
  }

  function paintPath(pathSlug) {
    var boxes = document.querySelectorAll('[data-path-check="' + pathSlug + '"]');
    var progress = read(progressKey, {});
    var done = 0;
    boxes.forEach(function (box) {
      var on = !!(progress[pathSlug] && progress[pathSlug][box.dataset.module]);
      box.checked = on;
      if (on) done += 1;
    });
    var note = document.querySelector('[data-path-count="' + pathSlug + '"]');
    if (note) note.textContent = done + ' of ' + boxes.length + ' published modules marked complete on this device.';
  }
  document.querySelectorAll('[data-path-check]').forEach(function (box) {
    var pathSlug = box.getAttribute('data-path-check');
    box.addEventListener('change', function () {
      var progress = read(progressKey, {});
      if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {};
      progress[pathSlug] = progress[pathSlug] && typeof progress[pathSlug] === 'object' ? progress[pathSlug] : {};
      progress[pathSlug][box.dataset.module] = box.checked;
      write(progressKey, progress);
      paintPath(pathSlug);
    });
  });
  var seen = {};
  document.querySelectorAll('[data-path-check]').forEach(function (box) {
    var pathSlug = box.getAttribute('data-path-check');
    if (seen[pathSlug]) return;
    seen[pathSlug] = true;
    paintPath(pathSlug);
  });
})();
