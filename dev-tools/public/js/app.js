/* ============================================================
   DevToolbox — App Controller & Tool Implementations
   ============================================================ */

// ---- App Init ----
(function() {
  const sidebar = document.getElementById('tool-list');
  const content = document.getElementById('content');
  const searchInput = document.getElementById('tool-search');
  const homeBtn = document.getElementById('home-btn');
  let currentTool = null;

  // ---- Tool Usage Tracking ----
  function trackToolUsage(id) {
    const data = JSON.parse(localStorage.getItem('devtoolbox_usage') || '{}');
    data[id] = (data[id] || 0) + 1;
    localStorage.setItem('devtoolbox_usage', JSON.stringify(data));
  }

  function getMostUsedTools(limit = 6) {
    const data = JSON.parse(localStorage.getItem('devtoolbox_usage') || '{}');
    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, count]) => ({ id, count, tool: TOOLS.find(t => t.id === id) }))
      .filter(entry => entry.tool);
  }

  // Build sidebar
  function buildSidebar(filter = '') {
    sidebar.innerHTML = '';
    let lastCat = '';
    const lower = filter.toLowerCase();
    TOOLS.forEach(tool => {
      if (lower && !tool.name.toLowerCase().includes(lower) && !tool.desc.toLowerCase().includes(lower)) return;
      if (tool.category !== lastCat) {
        lastCat = tool.category;
        const cat = document.createElement('li');
        cat.className = 'category';
        cat.textContent = tool.category;
        sidebar.appendChild(cat);
      }
      const li = document.createElement('li');
      li.dataset.id = tool.id;
      li.innerHTML = `<span class="icon">${tool.icon}</span><span>${tool.name}</span>`;
      if (currentTool === tool.id) li.classList.add('active');
      li.onclick = () => openTool(tool.id);
      sidebar.appendChild(li);
    });
  }

  // Go home
  function goHome() {
    currentTool = null;
    location.hash = '';
    document.querySelectorAll('.tool-list li[data-id]').forEach(li => li.classList.remove('active'));
    showWelcome();
  }
  homeBtn.style.cursor = 'pointer';
  homeBtn.addEventListener('click', goHome);

  // Open a tool
  window.openTool = function(id) {
    const tool = TOOLS.find(t => t.id === id);
    if (!tool) return;
    currentTool = id;
    trackToolUsage(id);
    content.innerHTML = `
      <div class="tool-view active">
        <h1 class="tool-title">${tool.icon} ${tool.name}</h1>
        <p class="tool-desc">${tool.desc}</p>
        ${tool.render()}
      </div>`;
    // Update sidebar active state
    document.querySelectorAll('.tool-list li[data-id]').forEach(li => {
      li.classList.toggle('active', li.dataset.id === id);
    });
    // Save to URL hash
    location.hash = id;
    // Call onMount if exists
    if (tool.onMount) setTimeout(tool.onMount, 0);
  };

  // Welcome screen
  function showWelcome() {
    const mostUsed = getMostUsedTools();
    let mostUsedHtml = '';
    if (mostUsed.length > 0) {
      mostUsedHtml = `
        <div class="most-used">
          <h2 class="most-used-title">Most Used</h2>
          <div class="most-used-grid">
            ${mostUsed.map(({ tool, count }) => `
              <div class="most-used-card" onclick="openTool('${tool.id}')">
                <span class="most-used-icon">${tool.icon}</span>
                <span class="most-used-name">${tool.name}</span>
                <span class="most-used-count">${count} use${count !== 1 ? 's' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    content.innerHTML = `
      <div class="welcome">
        <div class="big-icon">🧰</div>
        <h1>DevToolbox</h1>
        <p>All those little developer tools you need daily — JSON formatter, Base64, regex tester, diff checker, and more. Pick one from the sidebar or search.</p>
        <div class="shortcut-hint">
          Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to search tools
        </div>
        ${mostUsedHtml}
      </div>`;
  }

  // Search
  searchInput.addEventListener('input', () => buildSidebar(searchInput.value));

  // Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.blur();
      buildSidebar();
    }
  });

  // Init
  buildSidebar();
  const hash = location.hash.slice(1);
  if (hash && TOOLS.find(t => t.id === hash)) {
    openTool(hash);
  } else {
    showWelcome();
  }
})();

// ---- Utility Functions ----
function $(id) { return document.getElementById(id); }
function setOutput(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}
function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function copyOutput(id) {
  const el = $(id);
  if (!el) return;
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard!'));
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- JSON Formatter ----
function jsonFormat() {
  try {
    const obj = JSON.parse($('json-input').value);
    setOutput('json-output', JSON.stringify(obj, null, 2));
  } catch(e) { setOutput('json-output', '❌ ' + e.message); }
}
function jsonMinify() {
  try {
    const obj = JSON.parse($('json-input').value);
    setOutput('json-output', JSON.stringify(obj));
  } catch(e) { setOutput('json-output', '❌ ' + e.message); }
}
function jsonValidate() {
  try {
    JSON.parse($('json-input').value);
    setOutput('json-output', '✅ Valid JSON');
  } catch(e) { setOutput('json-output', '❌ Invalid: ' + e.message); }
}

function jsonStringify() {
  try {
    const input = $('json-input').value;
    setOutput('json-output', JSON.stringify(input));
  } catch(e) { setOutput('json-output', '❌ ' + e.message); }
}
function jsonUnstringify() {
  try {
    const input = $('json-input').value;
    const parsed = JSON.parse(input);
    if (typeof parsed === 'string') {
      // Try to parse the inner string as JSON and pretty-print it
      try {
        const inner = JSON.parse(parsed);
        setOutput('json-output', JSON.stringify(inner, null, 2));
      } catch {
        setOutput('json-output', parsed);
      }
    } else {
      setOutput('json-output', JSON.stringify(parsed, null, 2));
    }
  } catch(e) { setOutput('json-output', '❌ ' + e.message); }
}

// ---- JSON ↔ YAML ----
function toYaml() {
  try {
    const obj = JSON.parse($('jy-input').value);
    setOutput('jy-output', jsyaml.dump(obj, { indent: 2 }));
  } catch(e) { setOutput('jy-output', '❌ ' + e.message); }
}
function toJson() {
  try {
    const obj = jsyaml.load($('jy-input').value);
    setOutput('jy-output', JSON.stringify(obj, null, 2));
  } catch(e) { setOutput('jy-output', '❌ ' + e.message); }
}

// ---- Base64 ----
function b64Encode() {
  try {
    const input = $('b64-input').value;
    setOutput('b64-output', btoa(unescape(encodeURIComponent(input))));
  } catch(e) { setOutput('b64-output', '❌ ' + e.message); }
}
function b64Decode() {
  try {
    const input = $('b64-input').value;
    setOutput('b64-output', decodeURIComponent(escape(atob(input.trim()))));
  } catch(e) { setOutput('b64-output', '❌ ' + e.message); }
}

// ---- URL Encode/Decode ----
function urlEncode() {
  setOutput('url-enc-output', encodeURIComponent($('url-enc-input').value));
}
function urlDecode() {
  try {
    setOutput('url-enc-output', decodeURIComponent($('url-enc-input').value));
  } catch(e) { setOutput('url-enc-output', '❌ ' + e.message); }
}

// ---- HTML Entity ----
function htmlEntityEncode() {
  const input = $('html-ent-input').value;
  const encoded = input.replace(/[\u00A0-\u9999<>&"']/g, c => '&#' + c.charCodeAt(0) + ';');
  setOutput('html-ent-output', encoded);
}
function htmlEntityDecode() {
  const input = $('html-ent-input').value;
  const ta = document.createElement('textarea');
  ta.innerHTML = input;
  setOutput('html-ent-output', ta.value);
}

// ---- JWT Decoder ----
function decodeJwt() {
  const token = $('jwt-input').value.trim();
  if (!token) {
    setOutput('jwt-header', '');
    setOutput('jwt-payload', '');
    setOutput('jwt-info', '');
    return;
  }
  try {
    const parts = token.split('.');
    if (parts.length < 2) throw new Error('Invalid JWT — needs at least 2 parts');
    const header = JSON.parse(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    setOutput('jwt-header', JSON.stringify(header, null, 2));
    setOutput('jwt-payload', JSON.stringify(payload, null, 2));
    // Info
    let info = [];
    if (payload.exp) {
      const d = new Date(payload.exp * 1000);
      const expired = d < new Date();
      info.push(`Expires: ${d.toISOString()} ${expired ? '⚠️ EXPIRED' : '✅ Valid'}`);
    }
    if (payload.iat) info.push(`Issued:  ${new Date(payload.iat * 1000).toISOString()}`);
    if (payload.nbf) info.push(`Not Before: ${new Date(payload.nbf * 1000).toISOString()}`);
    if (payload.iss) info.push(`Issuer:  ${payload.iss}`);
    if (payload.sub) info.push(`Subject: ${payload.sub}`);
    if (payload.aud) info.push(`Audience: ${payload.aud}`);
    if (header.alg) info.push(`Algorithm: ${header.alg}`);
    setOutput('jwt-info', info.join('\n') || 'No standard claims found');
  } catch(e) { setOutput('jwt-info', '❌ ' + e.message); }
}

// ---- UUID / ULID ----
function genUuid() {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0;
    return (c==='x' ? r : (r&0x3|0x8)).toString(16);
  });
  setOutput('uuid-output', uuid);
}
function genUlid() {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now(), s = '';
  for (let i = 9; i >= 0; i--) { s = ENCODING[t % 32] + s; t = Math.floor(t / 32); }
  for (let i = 0; i < 16; i++) s += ENCODING[Math.random() * 32 | 0];
  setOutput('uuid-output', s);
}
function genBulkUuid() {
  const uuids = Array.from({length:10}, () =>
    crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0;
      return (c==='x' ? r : (r&0x3|0x8)).toString(16);
    })
  );
  setOutput('uuid-output', uuids.join('\n'));
}

// ---- Hash Generator ----
async function generateHashes() {
  const input = $('hash-input').value;
  if (!input) { ['sha256','sha512','sha1'].forEach(h => setOutput('hash-'+h, '')); return; }
  const enc = new TextEncoder().encode(input);
  for (const [name, algo] of [['sha256','SHA-256'],['sha512','SHA-512'],['sha1','SHA-1']]) {
    const buf = await crypto.subtle.digest(algo, enc);
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    setOutput('hash-' + name, hex);
  }
}

// ---- Lorem Ipsum ----
function genLorem() {
  const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');
  const count = parseInt($('lorem-count').value) || 3;
  const paragraphs = [];
  for (let p = 0; p < count; p++) {
    const len = 40 + Math.random() * 40 | 0;
    let sentence = [];
    for (let i = 0; i < len; i++) sentence.push(WORDS[Math.random() * WORDS.length | 0]);
    sentence[0] = sentence[0][0].toUpperCase() + sentence[0].slice(1);
    paragraphs.push(sentence.join(' ') + '.');
  }
  setOutput('lorem-output', paragraphs.join('\n\n'));
}

// ---- Password Generator ----
function genPassword() {
  const len = parseInt($('pw-len').value) || 24;
  let chars = '';
  if ($('pw-upper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if ($('pw-lower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
  if ($('pw-digits').checked) chars += '0123456789';
  if ($('pw-symbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) { setOutput('pw-output', '❌ Select at least one character set'); return; }
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  const pw = Array.from(arr).map(n => chars[n % chars.length]).join('');
  setOutput('pw-output', pw);
}

// ---- Timestamp Converter ----
function tsToDate() {
  const val = $('ts-input').value.trim();
  if (!val) { setOutput('ts-date-output', ''); return; }
  let ts = parseInt(val);
  if (val.length <= 10) ts *= 1000; // seconds → ms
  const d = new Date(ts);
  if (isNaN(d)) { setOutput('ts-date-output', '❌ Invalid timestamp'); return; }
  setOutput('ts-date-output',
    `Local:   ${d.toLocaleString()}\n` +
    `UTC:     ${d.toUTCString()}\n` +
    `ISO:     ${d.toISOString()}\n` +
    `Relative: ${timeAgo(d)}`
  );
}
function dateToTs() {
  const val = $('date-input').value.trim();
  if (!val) { setOutput('date-ts-output', ''); return; }
  const d = new Date(val);
  if (isNaN(d)) { setOutput('date-ts-output', '❌ Invalid date'); return; }
  setOutput('date-ts-output',
    `Seconds:      ${Math.floor(d.getTime()/1000)}\n` +
    `Milliseconds: ${d.getTime()}`
  );
}
function updateTimestampNow() {
  const el = $('ts-now');
  if (!el) return;
  const now = new Date();
  el.textContent =
    `Unix (s):  ${Math.floor(now.getTime()/1000)}\n` +
    `Unix (ms): ${now.getTime()}\n` +
    `ISO:       ${now.toISOString()}\n` +
    `Local:     ${now.toLocaleString()}`;
}
function timeAgo(d) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0) return `in ${formatDuration(-s)}`;
  return `${formatDuration(s)} ago`;
}
function formatDuration(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  if (s < 86400) return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h`;
}

// ---- Color Converter ----
function colorFromHex() {
  let hex = $('color-hex').value.trim().replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return;
  const r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
  $('color-rgb').value = `${r}, ${g}, ${b}`;
  $('color-hsl').value = rgbToHslStr(r,g,b);
  $('color-preview').style.background = '#' + hex;
}
function colorFromRgb() {
  const parts = $('color-rgb').value.split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return;
  const [r,g,b] = parts;
  $('color-hex').value = '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
  $('color-hsl').value = rgbToHslStr(r,g,b);
  $('color-preview').style.background = `rgb(${r},${g},${b})`;
}
function colorFromHsl() {
  const parts = $('color-hsl').value.replace(/%/g,'').split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return;
  const [h,s,l] = parts;
  const [r,g,b] = hslToRgb(h,s,l);
  $('color-hex').value = '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
  $('color-rgb').value = `${r}, ${g}, ${b}`;
  $('color-preview').style.background = `hsl(${h},${s}%,${l}%)`;
}
function rgbToHslStr(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;
  if(max===min) return `0, 0%, ${Math.round(l*100)}%`;
  const d=max-min, s=l>0.5?d/(2-max-min):d/(max+min);
  let h=0;
  if(max===r) h=(g-b)/d+(g<b?6:0);
  else if(max===g) h=(b-r)/d+2;
  else h=(r-g)/d+4;
  h=Math.round(h*60); 
  return `${h}, ${Math.round(s*100)}%, ${Math.round(l*100)}%`;
}
function hslToRgb(h,s,l) {
  s/=100; l/=100;
  const k=n=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
}

// ---- Number Base Converter ----
function convertBase() {
  const from = parseInt($('nb-from').value);
  const input = $('nb-input').value.trim();
  if (!input) { ['dec','hex','bin','oct'].forEach(id => setOutput('nb-'+id, '')); return; }
  try {
    const num = parseInt(input, from);
    if (isNaN(num)) throw new Error('Invalid');
    setOutput('nb-dec', num.toString(10));
    setOutput('nb-hex', num.toString(16).toUpperCase());
    setOutput('nb-bin', num.toString(2));
    setOutput('nb-oct', num.toString(8));
  } catch(e) { setOutput('nb-dec', '❌ Invalid number for base ' + from); }
}

// ---- String Case Converter ----
function convertCase() {
  const input = $('case-input').value;
  if (!input) {
    ['camel','pascal','snake','screaming','kebab','title','upper','lower'].forEach(c => setOutput('case-'+c, ''));
    return;
  }
  // Split into words
  const words = input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean);

  setOutput('case-camel', words.map((w,i) => i===0 ? w : w[0].toUpperCase()+w.slice(1)).join(''));
  setOutput('case-pascal', words.map(w => w[0].toUpperCase()+w.slice(1)).join(''));
  setOutput('case-snake', words.join('_'));
  setOutput('case-screaming', words.join('_').toUpperCase());
  setOutput('case-kebab', words.join('-'));
  setOutput('case-title', words.map(w => w[0].toUpperCase()+w.slice(1)).join(' '));
  setOutput('case-upper', input.toUpperCase());
  setOutput('case-lower', input.toLowerCase());
}

// ---- Regex Tester ----
function testRegex() {
  const pattern = $('regex-pattern').value;
  const flags = $('regex-flags').value;
  const input = $('regex-input').value;
  if (!pattern) { setHtml('regex-matches', ''); setHtml('regex-highlighted', ''); return; }
  try {
    const re = new RegExp(pattern, flags);
    const matches = [];
    let m;
    let i = 0;
    const clone = new RegExp(pattern, flags);
    if (flags.includes('g')) {
      while ((m = clone.exec(input)) !== null && i++ < 100) {
        matches.push({ full: m[0], groups: m.slice(1), index: m.index });
        if (m[0].length === 0) clone.lastIndex++;
      }
    } else {
      m = clone.exec(input);
      if (m) matches.push({ full: m[0], groups: m.slice(1), index: m.index });
    }
    // Show matches
    let html = `<strong>${matches.length} match${matches.length!==1?'es':''}</strong>\n\n`;
    matches.forEach((mt, idx) => {
      html += `<strong>Match ${idx+1}</strong> at index ${mt.index}: "${escapeHtml(mt.full)}"\n`;
      mt.groups.forEach((g, gi) => {
        html += `  Group ${gi+1}: "${escapeHtml(g || '')}"\n`;
      });
    });
    setHtml('regex-matches', html);
    // Highlight
    const highlighted = escapeHtml(input).replace(new RegExp(pattern.replace(/[&<>"']/g, c => '&#'+c.charCodeAt(0)+';'), flags), match =>
      `<span class="regex-match">${match}</span>`
    );
    setHtml('regex-highlighted', highlighted);
  } catch(e) { setHtml('regex-matches', '❌ ' + escapeHtml(e.message)); }
}

// ---- Diff Checker ----
function runDiff() {
  const left = $('diff-left').value;
  const right = $('diff-right').value;
  if (typeof Diff === 'undefined') { setOutput('diff-output', '❌ Diff library not loaded'); return; }
  const diff = Diff.diffLines(left, right);
  let html = '';
  diff.forEach(part => {
    const escaped = escapeHtml(part.value);
    if (part.added) {
      html += `<span class="diff-added">+ ${escaped}</span>`;
    } else if (part.removed) {
      html += `<span class="diff-removed">- ${escaped}</span>`;
    } else {
      html += `  ${escaped}`;
    }
  });
  setHtml('diff-output', html || 'No differences found ✅');
}
function clearDiff() {
  $('diff-left').value = '';
  $('diff-right').value = '';
  setHtml('diff-output', '');
}

// ---- Markdown Preview ----
function renderMarkdown() {
  const input = $('md-input').value;
  if (typeof marked === 'undefined') { setHtml('md-output', '❌ Marked library not loaded'); return; }
  setHtml('md-output', marked.parse(input));
}

// ---- Text Stats ----
function textStats() {
  const input = $('stats-input').value;
  if (!input) { setOutput('stats-output', ''); return; }
  const chars = input.length;
  const charsNoSpace = input.replace(/\s/g, '').length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const lines = input.split('\n').length;
  const sentences = input.split(/[.!?]+/).filter(s => s.trim()).length;
  const paragraphs = input.split(/\n\s*\n/).filter(s => s.trim()).length;
  const bytes = new Blob([input]).size;
  const readTime = Math.max(1, Math.ceil(words / 200));

  setOutput('stats-output',
    `Characters:         ${chars.toLocaleString()}\n` +
    `Characters (no sp): ${charsNoSpace.toLocaleString()}\n` +
    `Words:              ${words.toLocaleString()}\n` +
    `Lines:              ${lines.toLocaleString()}\n` +
    `Sentences:          ${sentences.toLocaleString()}\n` +
    `Paragraphs:         ${paragraphs.toLocaleString()}\n` +
    `Bytes (UTF-8):      ${bytes.toLocaleString()}\n` +
    `Reading time:       ~${readTime} min`
  );
}

// ---- URL Parser ----
function parseUrl() {
  const input = $('url-input').value.trim();
  if (!input) { setOutput('url-output', ''); return; }
  try {
    const u = new URL(input);
    let params = '';
    u.searchParams.forEach((v, k) => { params += `  ${k} = ${v}\n`; });
    setOutput('url-output',
      `Protocol:  ${u.protocol}\n` +
      `Host:      ${u.host}\n` +
      `Hostname:  ${u.hostname}\n` +
      `Port:      ${u.port || '(default)'}\n` +
      `Pathname:  ${u.pathname}\n` +
      `Search:    ${u.search}\n` +
      `Hash:      ${u.hash}\n` +
      `Origin:    ${u.origin}\n` +
      `Username:  ${u.username || '(none)'}\n` +
      `Password:  ${u.password || '(none)'}\n\n` +
      `Query Parameters:\n${params || '  (none)'}`
    );
  } catch(e) { setOutput('url-output', '❌ ' + e.message); }
}

// ---- QR Code Generator ----
function genQr() {
  const text = $('qr-input').value.trim();
  const container = $('qr-output');
  container.innerHTML = '';
  if (!text) return;
  if (typeof QRCode === 'undefined') { container.textContent = '❌ QRCode library not loaded'; return; }
  new QRCode(container, {
    text,
    width: 256,
    height: 256,
    colorDark: '#e6edf3',
    colorLight: '#0d1117',
    correctLevel: QRCode.CorrectLevel.M
  });
}

// ---- Cron Parser ----
function parseCron() {
  const input = $('cron-input').value.trim();
  if (!input) { setOutput('cron-output', ''); return; }
  const parts = input.split(/\s+/);
  if (parts.length < 5) { setOutput('cron-output', '❌ Need 5 fields: min hour dom month dow'); return; }
  // Update individual fields
  const fields = ['cron-min','cron-hour','cron-dom','cron-month','cron-dow'];
  parts.slice(0,5).forEach((v,i) => { if ($(fields[i])) $(fields[i]).value = v; });
  // Human readable
  setOutput('cron-output', describeCron(parts));
}
function buildCron() {
  const fields = ['cron-min','cron-hour','cron-dom','cron-month','cron-dow'];
  const expr = fields.map(id => $(id).value || '*').join(' ');
  $('cron-input').value = expr;
  parseCron();
}
function describeCron(parts) {
  const [min, hour, dom, month, dow] = parts;
  let desc = [];

  // Minute
  if (min === '*') desc.push('Every minute');
  else if (min.startsWith('*/')) desc.push(`Every ${min.slice(2)} minutes`);
  else desc.push(`At minute ${min}`);

  // Hour
  if (hour !== '*') {
    if (hour.startsWith('*/')) desc.push(`every ${hour.slice(2)} hours`);
    else desc.push(`past hour ${hour}`);
  }

  // Day of month
  if (dom !== '*') {
    if (dom.startsWith('*/')) desc.push(`every ${dom.slice(2)} days`);
    else desc.push(`on day ${dom} of the month`);
  }

  // Month
  const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (month !== '*') {
    const m = parseInt(month);
    desc.push(`in ${months[m] || month}`);
  }

  // Day of week
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  if (dow !== '*') {
    if (dow.includes('-')) {
      const [a,b] = dow.split('-').map(Number);
      desc.push(`${days[a]} through ${days[b]}`);
    } else {
      const dayNums = dow.split(',').map(Number);
      desc.push(`on ${dayNums.map(d => days[d] || d).join(', ')}`);
    }
  }

  return desc.join(', ');
}

// ---- JSON → TypeScript / Go ----
function jsonToTs() {
  try {
    const obj = JSON.parse($('type-input').value);
    const result = generateTsInterface(obj, 'Root');
    setOutput('type-output', result);
  } catch(e) { setOutput('type-output', '❌ ' + e.message); }
}
function generateTsInterface(obj, name, indent = '') {
  if (typeof obj !== 'object' || obj === null) return '';
  let lines = [`${indent}interface ${name} {`];
  for (const [key, val] of Object.entries(obj)) {
    const type = tsType(val, key, indent + '  ');
    lines.push(`${indent}  ${key}: ${type};`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}
function tsType(val, key, indent) {
  if (val === null) return 'null';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'any[]';
    return tsType(val[0], key, indent) + '[]';
  }
  if (typeof val === 'object') {
    return '{\n' + Object.entries(val).map(([k,v]) =>
      `${indent}  ${k}: ${tsType(v, k, indent + '  ')};`
    ).join('\n') + `\n${indent}}`;
  }
  return typeof val;
}

function jsonToGo() {
  try {
    const obj = JSON.parse($('type-input').value);
    const result = generateGoStruct(obj, 'Root');
    setOutput('type-output', result);
  } catch(e) { setOutput('type-output', '❌ ' + e.message); }
}
function generateGoStruct(obj, name, indent = '') {
  if (typeof obj !== 'object' || obj === null) return '';
  let lines = [`${indent}type ${name} struct {`];
  for (const [key, val] of Object.entries(obj)) {
    const goName = key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    const type = goType(val);
    lines.push(`${indent}\t${goName} ${type} \`json:"${key}"\``);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}
function goType(val) {
  if (val === null) return 'interface{}';
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]interface{}';
    return '[]' + goType(val[0]);
  }
  switch (typeof val) {
    case 'string': return 'string';
    case 'number': return Number.isInteger(val) ? 'int' : 'float64';
    case 'boolean': return 'bool';
    case 'object': return 'struct { /* nested */ }';
    default: return 'interface{}';
  }
}

// ---- JSON → C# ----
function jsonToCsharp() {
  try {
    const obj = JSON.parse($('type-input').value);
    const result = generateCsharpClass(obj, 'Root');
    setOutput('type-output', result);
  } catch(e) { setOutput('type-output', '❌ ' + e.message); }
}
function generateCsharpClass(obj, name, indent = '') {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return '';
  let lines = [`${indent}public class ${name}`];
  lines.push(`${indent}{`);
  const nested = [];
  for (const [key, val] of Object.entries(obj)) {
    const propName = key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-](\w)/g, (_, c) => c.toUpperCase());
    const { type, nestedClass } = csharpType(val, propName);
    lines.push(`${indent}    [JsonPropertyName("${key}")]`);
    lines.push(`${indent}    public ${type} ${propName} { get; set; }`);
    lines.push('');
    if (nestedClass) nested.push({ obj: val, name: propName });
  }
  // Remove trailing blank line
  if (lines[lines.length - 1] === '') lines.pop();
  lines.push(`${indent}}`);
  // Append nested classes
  for (const n of nested) {
    const nestedObj = Array.isArray(n.obj) ? n.obj[0] : n.obj;
    if (typeof nestedObj === 'object' && nestedObj !== null && !Array.isArray(nestedObj)) {
      lines.push('');
      lines.push(generateCsharpClass(nestedObj, n.name, indent));
    }
  }
  return lines.join('\n');
}
function csharpType(val, propName) {
  if (val === null) return { type: 'object?', nestedClass: false };
  if (Array.isArray(val)) {
    if (val.length === 0) return { type: 'List<object>', nestedClass: false };
    const inner = csharpType(val[0], propName);
    return { type: `List<${inner.type}>`, nestedClass: inner.nestedClass };
  }
  switch (typeof val) {
    case 'string': return { type: 'string', nestedClass: false };
    case 'number': return { type: Number.isInteger(val) ? 'int' : 'double', nestedClass: false };
    case 'boolean': return { type: 'bool', nestedClass: false };
    case 'object': return { type: propName, nestedClass: true };
    default: return { type: 'object', nestedClass: false };
  }
}
