function testRegex(pattern, flags, text) {
  var source = String(pattern || '');
  var sample = String(text || '');
  if (!source) return { ok: false, error: 'Enter a pattern.' };
  if (source.length > 300) return { ok: false, error: 'Pattern is limited to 300 characters here.' };
  if (sample.length > 20000) return { ok: false, error: 'Test text is limited to 20,000 characters here.' };
  var cleanFlags = Array.from(new Set(String(flags || '').split(''))).filter(function (flag) { return 'gimsuy'.indexOf(flag) !== -1; }).join('');
  var re;
  try { re = new RegExp(source, cleanFlags); }
  catch (error) { return { ok: false, error: error.message || 'Invalid regular expression.' }; }
  var matches = [];
  var limit = 100;
  if (cleanFlags.indexOf('g') !== -1) {
    var match;
    var guard = 0;
    while ((match = re.exec(sample)) && matches.length < limit && guard < 10000) {
      matches.push({ index: match.index, value: match[0], groups: match.slice(1) });
      if (match[0] === '') re.lastIndex += 1;
      guard += 1;
    }
  } else {
    var once = re.exec(sample);
    if (once) matches.push({ index: once.index, value: once[0], groups: once.slice(1) });
  }
  return { ok: true, matches: matches, truncated: matches.length >= limit, engine: 'javascript' };
}

self.onmessage = function (event) {
  var data = event.data || {};
  self.postMessage(testRegex(data.pattern, data.flags, data.text));
};
