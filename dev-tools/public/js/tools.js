/* ============================================================
   DevToolbox — Tool Definitions & Logic
   ============================================================ */

const TOOLS = [
  // ---- Formatters & Converters ----
  {
  id: 'json-formatter',
  name: 'JSON Formatter',
  icon: '{ }',
  category: 'Formatters',
  desc: 'Format, minify, validate, stringify and unstringify JSON',
  render: () => `
    <div class="btn-group">
      <button class="btn btn-sm" onclick="jsonFormat()">Format</button>
      <button class="btn btn-sm btn-outline" onclick="jsonMinify()">Minify</button>
      <button class="btn btn-sm btn-outline" onclick="jsonValidate()">Validate</button>
      <button class="btn btn-sm btn-outline" onclick="jsonStringify()">Stringify</button>
      <button class="btn btn-sm btn-outline" onclick="jsonUnstringify()">Unstringify</button>
      <button class="btn btn-sm btn-outline" onclick="copyOutput('json-output')">Copy</button>
    </div>
    <div class="row equal">
      <div class="panel">
        <div class="panel-header">Input</div>
        <textarea id="json-input" rows="18" placeholder='Paste JSON here...'></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Output</div>
        <div class="output" id="json-output" style="min-height:380px"></div>
      </div>
    </div>`,
  },
  {
    id: 'json-yaml',
    name: 'JSON ↔ YAML',
    icon: '🔄',
    category: 'Formatters',
    desc: 'Convert between JSON and YAML',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="toYaml()">JSON → YAML</button>
        <button class="btn btn-sm btn-outline" onclick="toJson()">YAML → JSON</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('jy-output')">Copy</button>
      </div>
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Input</div>
          <textarea id="jy-input" rows="18" placeholder="Paste JSON or YAML..."></textarea>
        </div>
        <div class="panel">
          <div class="panel-header">Output</div>
          <div class="output" id="jy-output" style="min-height:380px"></div>
        </div>
      </div>`,
  },
  // ---- Encoders / Decoders ----
  {
    id: 'base64',
    name: 'Base64 Encode/Decode',
    icon: '🔐',
    category: 'Encoders',
    desc: 'Encode and decode Base64 strings',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="b64Encode()">Encode</button>
        <button class="btn btn-sm btn-outline" onclick="b64Decode()">Decode</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('b64-output')">Copy</button>
      </div>
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="b64-input" rows="6" placeholder="Text to encode/decode..."></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Output</div>
        <div class="output" id="b64-output"></div>
      </div>`,
  },
  {
    id: 'url-encode',
    name: 'URL Encode/Decode',
    icon: '🔗',
    category: 'Encoders',
    desc: 'Encode and decode URL components',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="urlEncode()">Encode</button>
        <button class="btn btn-sm btn-outline" onclick="urlDecode()">Decode</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('url-enc-output')">Copy</button>
      </div>
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="url-enc-input" rows="4" placeholder="Text or URL to encode/decode..."></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Output</div>
        <div class="output" id="url-enc-output"></div>
      </div>`,
  },
  {
    id: 'html-entity',
    name: 'HTML Entity Encode/Decode',
    icon: '&lt;',
    category: 'Encoders',
    desc: 'Encode/decode HTML entities',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="htmlEntityEncode()">Encode</button>
        <button class="btn btn-sm btn-outline" onclick="htmlEntityDecode()">Decode</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('html-ent-output')">Copy</button>
      </div>
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="html-ent-input" rows="4" placeholder="<div>Hello &amp; world</div>"></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Output</div>
        <div class="output" id="html-ent-output"></div>
      </div>`,
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    icon: '🎟️',
    category: 'Encoders',
    desc: 'Decode and inspect JWT tokens',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">JWT Token</div>
        <textarea id="jwt-input" rows="4" placeholder="Paste JWT token here..." oninput="decodeJwt()"></textarea>
      </div>
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Header</div>
          <div class="output" id="jwt-header"></div>
        </div>
        <div class="panel">
          <div class="panel-header">Payload</div>
          <div class="output" id="jwt-payload"></div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Token Info</div>
        <div class="output" id="jwt-info"></div>
      </div>`,
  },
  // ---- Generators ----
  {
    id: 'uuid-gen',
    name: 'UUID / ULID Generator',
    icon: '🆔',
    category: 'Generators',
    desc: 'Generate UUIDs (v4) and ULIDs',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="genUuid()">Generate UUID v4</button>
        <button class="btn btn-sm btn-outline" onclick="genUlid()">Generate ULID</button>
        <button class="btn btn-sm btn-outline" onclick="genBulkUuid()">Bulk (10)</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('uuid-output')">Copy</button>
      </div>
      <div class="panel">
        <div class="output" id="uuid-output" style="min-height:120px"></div>
      </div>`,
  },
  {
    id: 'hash-gen',
    name: 'Hash Generator',
    icon: '#️⃣',
    category: 'Generators',
    desc: 'Generate MD5, SHA-1, SHA-256, SHA-512 hashes',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="hash-input" rows="4" placeholder="Text to hash..." oninput="generateHashes()"></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Hashes</div>
        <div id="hash-output">
          <div style="margin-bottom:10px"><label>SHA-256</label><div class="output" id="hash-sha256"></div></div>
          <div style="margin-bottom:10px"><label>SHA-512</label><div class="output" id="hash-sha512"></div></div>
          <div style="margin-bottom:10px"><label>SHA-1</label><div class="output" id="hash-sha1"></div></div>
        </div>
      </div>`,
  },
  {
    id: 'lorem',
    name: 'Lorem Ipsum Generator',
    icon: '📝',
    category: 'Generators',
    desc: 'Generate placeholder text',
    render: () => `
      <div class="inline-options">
        <label>Paragraphs:</label>
        <input type="number" id="lorem-count" value="3" min="1" max="50" style="width:70px">
        <button class="btn btn-sm" onclick="genLorem()">Generate</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('lorem-output')">Copy</button>
      </div>
      <div class="panel">
        <div class="output" id="lorem-output" style="min-height:200px;white-space:pre-wrap"></div>
      </div>`,
  },
  {
    id: 'password-gen',
    name: 'Password Generator',
    icon: '🔑',
    category: 'Generators',
    desc: 'Generate strong random passwords',
    render: () => `
      <div class="inline-options">
        <label>Length:</label>
        <input type="number" id="pw-len" value="24" min="4" max="128" style="width:70px">
        <label><input type="checkbox" id="pw-upper" checked> A-Z</label>
        <label><input type="checkbox" id="pw-lower" checked> a-z</label>
        <label><input type="checkbox" id="pw-digits" checked> 0-9</label>
        <label><input type="checkbox" id="pw-symbols" checked> !@#$</label>
        <button class="btn btn-sm" onclick="genPassword()">Generate</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('pw-output')">Copy</button>
      </div>
      <div class="panel">
        <div class="output" id="pw-output" style="font-size:18px;letter-spacing:1px"></div>
      </div>`,
  },
  // ---- Converters ----
  {
    id: 'timestamp',
    name: 'Timestamp Converter',
    icon: '🕐',
    category: 'Converters',
    desc: 'Convert between Unix timestamps and human-readable dates',
    render: () => `
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Unix Timestamp → Date</div>
          <input type="text" id="ts-input" placeholder="e.g. 1700000000" oninput="tsToDate()">
          <div class="output" id="ts-date-output" style="margin-top:10px"></div>
        </div>
        <div class="panel">
          <div class="panel-header">Date → Unix Timestamp</div>
          <input type="text" id="date-input" placeholder="e.g. 2025-01-15T12:00:00Z" oninput="dateToTs()">
          <div class="output" id="date-ts-output" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Current Time</div>
        <div class="output" id="ts-now"></div>
      </div>`,
    onMount: () => { updateTimestampNow(); setInterval(updateTimestampNow, 1000); }
  },
  {
    id: 'color-convert',
    name: 'Color Converter',
    icon: '🎨',
    category: 'Converters',
    desc: 'Convert between HEX, RGB, and HSL color formats',
    render: () => `
      <div class="color-preview" id="color-preview" style="background:#58a6ff"></div>
      <div class="row equal">
        <div class="panel">
          <label>HEX</label>
          <input type="text" id="color-hex" value="#58a6ff" oninput="colorFromHex()">
        </div>
        <div class="panel">
          <label>RGB</label>
          <input type="text" id="color-rgb" placeholder="88, 166, 255" oninput="colorFromRgb()">
        </div>
        <div class="panel">
          <label>HSL</label>
          <input type="text" id="color-hsl" placeholder="212, 100%, 67%" oninput="colorFromHsl()">
        </div>
      </div>`,
    onMount: () => colorFromHex()
  },
  {
    id: 'number-base',
    name: 'Number Base Converter',
    icon: '🔢',
    category: 'Converters',
    desc: 'Convert between decimal, hex, binary, and octal',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="inline-options">
          <label>Input base:</label>
          <select id="nb-from" onchange="convertBase()">
            <option value="10" selected>Decimal (10)</option>
            <option value="16">Hex (16)</option>
            <option value="2">Binary (2)</option>
            <option value="8">Octal (8)</option>
          </select>
        </div>
        <input type="text" id="nb-input" placeholder="Enter number..." oninput="convertBase()">
      </div>
      <div class="panel">
        <div class="panel-header">Results</div>
        <div id="nb-output">
          <div style="margin-bottom:8px"><label>Decimal</label><div class="output" id="nb-dec"></div></div>
          <div style="margin-bottom:8px"><label>Hexadecimal</label><div class="output" id="nb-hex"></div></div>
          <div style="margin-bottom:8px"><label>Binary</label><div class="output" id="nb-bin"></div></div>
          <div style="margin-bottom:8px"><label>Octal</label><div class="output" id="nb-oct"></div></div>
        </div>
      </div>`,
  },
  {
    id: 'case-convert',
    name: 'String Case Converter',
    icon: 'Aa',
    category: 'Converters',
    desc: 'Convert between camelCase, snake_case, kebab-case, PascalCase, etc.',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="case-input" rows="3" placeholder="Type or paste text here..." oninput="convertCase()"></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Results</div>
        <div id="case-output">
          <div style="margin-bottom:8px"><label>camelCase</label><div class="output" id="case-camel"></div></div>
          <div style="margin-bottom:8px"><label>PascalCase</label><div class="output" id="case-pascal"></div></div>
          <div style="margin-bottom:8px"><label>snake_case</label><div class="output" id="case-snake"></div></div>
          <div style="margin-bottom:8px"><label>SCREAMING_SNAKE</label><div class="output" id="case-screaming"></div></div>
          <div style="margin-bottom:8px"><label>kebab-case</label><div class="output" id="case-kebab"></div></div>
          <div style="margin-bottom:8px"><label>Title Case</label><div class="output" id="case-title"></div></div>
          <div style="margin-bottom:8px"><label>UPPERCASE</label><div class="output" id="case-upper"></div></div>
          <div style="margin-bottom:8px"><label>lowercase</label><div class="output" id="case-lower"></div></div>
        </div>
      </div>`,
  },
  // ---- Text Tools ----
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    icon: '.*',
    category: 'Text Tools',
    desc: 'Test regular expressions with live highlighting and match groups',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Pattern</div>
        <div class="row" style="margin-bottom:0">
          <div style="flex:1"><input type="text" id="regex-pattern" placeholder="e.g. (\\w+)@(\\w+\\.\\w+)" oninput="testRegex()"></div>
          <div style="width:100px"><input type="text" id="regex-flags" value="gm" placeholder="flags" oninput="testRegex()" style="text-align:center"></div>
        </div>
      </div>
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Test String</div>
          <textarea id="regex-input" rows="10" placeholder="Text to test against..." oninput="testRegex()"></textarea>
        </div>
        <div class="panel">
          <div class="panel-header">Matches</div>
          <div class="output" id="regex-matches" style="min-height:210px"></div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Highlighted</div>
        <div class="output" id="regex-highlighted" style="min-height:60px"></div>
      </div>`,
  },
  {
    id: 'diff-checker',
    name: 'Diff Checker',
    icon: '±',
    category: 'Text Tools',
    desc: 'Compare two texts side by side',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="runDiff()">Compare</button>
        <button class="btn btn-sm btn-outline" onclick="clearDiff()">Clear</button>
      </div>
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Original</div>
          <textarea id="diff-left" rows="14" placeholder="Paste original text..."></textarea>
        </div>
        <div class="panel">
          <div class="panel-header">Modified</div>
          <textarea id="diff-right" rows="14" placeholder="Paste modified text..."></textarea>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Diff Result</div>
        <div class="output" id="diff-output" style="min-height:120px;max-height:600px"></div>
      </div>`,
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    icon: 'M↓',
    category: 'Text Tools',
    desc: 'Live Markdown preview',
    render: () => `
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">Markdown</div>
          <textarea id="md-input" rows="22" placeholder="# Hello World\n\nWrite markdown here..." oninput="renderMarkdown()"></textarea>
        </div>
        <div class="panel">
          <div class="panel-header">Preview</div>
          <div class="md-preview" id="md-output"></div>
        </div>
      </div>`,
  },
  {
    id: 'text-stats',
    name: 'Text Stats & Counter',
    icon: '📊',
    category: 'Text Tools',
    desc: 'Count characters, words, lines, and more',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Input</div>
        <textarea id="stats-input" rows="10" placeholder="Paste or type text here..." oninput="textStats()"></textarea>
      </div>
      <div class="panel">
        <div class="panel-header">Statistics</div>
        <div class="output" id="stats-output"></div>
      </div>`,
  },
  // ---- Web Tools ----
  {
    id: 'url-parser',
    name: 'URL Parser',
    icon: '🌐',
    category: 'Web Tools',
    desc: 'Parse and inspect URL components',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">URL</div>
        <input type="text" id="url-input" placeholder="https://example.com/path?key=value#hash" oninput="parseUrl()">
      </div>
      <div class="panel">
        <div class="panel-header">Components</div>
        <div class="output" id="url-output" style="min-height:200px"></div>
      </div>`,
  },
  {
    id: 'qr-gen',
    name: 'QR Code Generator',
    icon: '📱',
    category: 'Web Tools',
    desc: 'Generate QR codes from text or URLs',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Text / URL</div>
        <textarea id="qr-input" rows="3" placeholder="Enter text or URL..."></textarea>
        <button class="btn btn-sm" style="margin-top:10px" onclick="genQr()">Generate QR</button>
      </div>
      <div class="panel">
        <div class="qr-output" id="qr-output"></div>
      </div>`,
  },
  {
    id: 'cron-parser',
    name: 'Cron Expression Parser',
    icon: '⏰',
    category: 'Web Tools',
    desc: 'Parse cron expressions into human-readable format',
    render: () => `
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">Cron Expression</div>
        <input type="text" id="cron-input" placeholder="*/5 * * * *" oninput="parseCron()">
        <div class="cron-fields" style="margin-top:12px">
          <div><label>Minute</label><input type="text" id="cron-min" value="*" oninput="buildCron()"></div>
          <div><label>Hour</label><input type="text" id="cron-hour" value="*" oninput="buildCron()"></div>
          <div><label>Day (M)</label><input type="text" id="cron-dom" value="*" oninput="buildCron()"></div>
          <div><label>Month</label><input type="text" id="cron-month" value="*" oninput="buildCron()"></div>
          <div><label>Day (W)</label><input type="text" id="cron-dow" value="*" oninput="buildCron()"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">Human Readable</div>
        <div class="output" id="cron-output" style="font-size:15px"></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-header">Common Examples</div>
        <div class="btn-group" id="cron-examples"></div>
      </div>`,
    onMount: () => {
      const examples = [
        ['Every minute', '* * * * *'],
        ['Every 5 min', '*/5 * * * *'],
        ['Hourly', '0 * * * *'],
        ['Daily midnight', '0 0 * * *'],
        ['Weekdays 9am', '0 9 * * 1-5'],
        ['Monthly 1st', '0 0 1 * *'],
      ];
      const el = document.getElementById('cron-examples');
      el.innerHTML = examples.map(([l, v]) =>
        `<button class="btn btn-sm btn-outline" onclick="document.getElementById('cron-input').value='${v}';parseCron()">${l}<br><small style="opacity:.6">${v}</small></button>`
      ).join('');
      parseCron();
    }
  },
  {
    id: 'json-to-type',
    name: 'JSON → Types',
    icon: '📐',
    category: 'Converters',
    desc: 'Generate TypeScript interfaces, Go structs, or C# classes from JSON',
    render: () => `
      <div class="btn-group">
        <button class="btn btn-sm" onclick="jsonToTs()">→ TypeScript</button>
        <button class="btn btn-sm btn-outline" onclick="jsonToGo()">→ Go Struct</button>
        <button class="btn btn-sm btn-outline" onclick="jsonToCsharp()">→ C#</button>
        <button class="btn btn-sm btn-outline" onclick="copyOutput('type-output')">Copy</button>
      </div>
      <div class="row equal">
        <div class="panel">
          <div class="panel-header">JSON Input</div>
          <textarea id="type-input" rows="18" placeholder='{"name":"John","age":30,"items":[1,2,3]}'></textarea>
        </div>
        <div class="panel">
          <div class="panel-header">Output</div>
          <div class="output" id="type-output" style="min-height:380px"></div>
        </div>
      </div>`,
  },
];
