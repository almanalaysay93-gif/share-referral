// Loads the offline Python referral reader (py/referral_parser.py) in Pyodide.
// The Python runs in this browser tab. No text leaves the page here.
(function () {
  'use strict';
  const cfg = window.SHARE_CONFIG;
  let ready = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  function start() {
    if (ready) return ready;
    ready = (async () => {
      if (!window.loadPyodide) await loadScript(cfg.PYODIDE_URL + 'pyodide.js');
      const [pyodide, source] = await Promise.all([
        window.loadPyodide({ indexURL: cfg.PYODIDE_URL }),
        fetch(cfg.PARSER_URL).then((r) => {
          if (!r.ok) throw new Error('Parser file HTTP ' + r.status);
          return r.text();
        }),
      ]);
      pyodide.runPython(source);
      return pyodide.globals.get('parse_referral_json');
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }

  async function read(text) {
    const parse = await start();
    return JSON.parse(parse(text));
  }

  window.ReferralReader = { start, read };
})();
