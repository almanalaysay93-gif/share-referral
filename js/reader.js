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
      return {
        parse: pyodide.globals.get('parse_referral_json'),
        extract: pyodide.globals.get('extract_text_json'),
      };
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }

  async function read(text) {
    const py = await start();
    return JSON.parse(py.parse(text));
  }

  /** Word (.docx), Excel (.xlsx), CSV or text file -> referral text. Read in this tab, never uploaded. */
  async function extract(file) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'This file is larger than 5 MB.' };
    const [py, buffer] = await Promise.all([start(), file.arrayBuffer()]);
    return JSON.parse(py.extract(file.name, new Uint8Array(buffer)));
  }

  window.ReferralReader = { start, read, extract };
})();
