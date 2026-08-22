/* ============================================================
   NoteForge — Developer Note-Taking App
   Core Application Logic
   ============================================================ */

// ─── Utility Functions ─────────────────────────────────────────
function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatFullDate(iso) {
    return new Date(iso).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function getStorageSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += localStorage.getItem(key).length * 2; // UTF-16
    }
    return total;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Storage Manager ───────────────────────────────────────────
class StorageManager {
    constructor() {
        this.NOTES_KEY = 'noteforge_notes';
        this.SETTINGS_KEY = 'noteforge_settings';
    }

    getNotes() {
        try {
            return JSON.parse(localStorage.getItem(this.NOTES_KEY)) || {};
        } catch { return {}; }
    }

    saveNotes(notes) {
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
    }

    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {};
        } catch { return {}; }
    }

    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    }

    getStorageInfo() {
        const used = getStorageSize();
        const max = 5 * 1024 * 1024; // 5MB estimate
        return { used, max, percent: Math.min((used / max) * 100, 100) };
    }
}

// ─── Note Templates ────────────────────────────────────────────
const TEMPLATES = [
    {
        name: 'Meeting Notes',
        icon: '📋',
        desc: 'Structured template for meeting notes',
        content: `<h2>Meeting Notes</h2><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><h3>Discussion Points</h3><ul><li>Point 1</li><li>Point 2</li></ul><h3>Action Items</h3><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Action item 1</span></div><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Action item 2</span></div><h3>Notes</h3><p></p>`
    },
    {
        name: 'Daily Standup',
        icon: '🌅',
        desc: 'Yesterday / Today / Blockers format',
        content: `<h2>Daily Standup — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h2><h3>✅ Yesterday</h3><ul><li></li></ul><h3>📌 Today</h3><ul><li></li></ul><h3>🚧 Blockers</h3><ul><li></li></ul>`
    },
    {
        name: 'TODO List',
        icon: '☑️',
        desc: 'Simple checkbox todo list',
        content: `<h2>TODO List</h2><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Task 1</span></div><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Task 2</span></div><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Task 3</span></div><p></p>`
    },
    {
        name: 'Bug Report',
        icon: '🐛',
        desc: 'Template for tracking bugs',
        content: `<h2>Bug Report</h2><p><strong>Severity:</strong> P0 / P1 / P2 / P3</p><p><strong>Component:</strong> </p><h3>Description</h3><p></p><h3>Steps to Reproduce</h3><ol><li>Step 1</li><li>Step 2</li></ol><h3>Expected Behavior</h3><p></p><h3>Actual Behavior</h3><p></p><h3>Environment</h3><ul><li>OS: </li><li>Browser: </li><li>Version: </li></ul>`
    },
    {
        name: 'Code Review Notes',
        icon: '🔍',
        desc: 'Notes for code review sessions',
        content: `<h2>Code Review Notes</h2><p><strong>PR:</strong> #</p><p><strong>Author:</strong> </p><p><strong>Branch:</strong> </p><h3>Summary</h3><p></p><h3>Feedback</h3><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Review item 1</span></div><h3>Code Snippets</h3><div class="code-block-wrap" contenteditable="false"><div class="code-block-header"><select onchange="app.onCodeLangChange(this)"><option value="plaintext">plaintext</option><option value="javascript">javascript</option><option value="typescript">typescript</option><option value="python">python</option><option value="csharp">csharp</option></select><div class="code-block-actions"><button class="copy-code-btn" onclick="app.copyCodeBlock(this)">Copy</button><button class="delete-block-btn" onclick="app.deleteBlock(this.closest('.code-block-wrap'))" title="Delete code block">✕</button></div></div><textarea class="code-textarea" spellcheck="false" placeholder="Type or paste code here...">// paste code here</textarea></div><p></p>`
    },
    {
        name: '1:1 Notes',
        icon: '👥',
        desc: 'Template for 1:1 meetings',
        content: `<h2>1:1 Notes</h2><p><strong>With:</strong> </p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h3>Topics to Discuss</h3><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Topic 1</span></div><h3>Notes</h3><p></p><h3>Follow-ups</h3><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Follow-up 1</span></div>`
    },
    {
        name: 'Sprint Retrospective',
        icon: '🔄',
        desc: 'What went well / What to improve',
        content: `<h2>Sprint Retrospective</h2><p><strong>Sprint:</strong> </p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h3>🟢 What Went Well</h3><ul><li></li></ul><h3>🔴 What Didn't Go Well</h3><ul><li></li></ul><h3>🔵 Action Items</h3><div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Improvement action</span></div>`
    },
    {
        name: 'Blank Note',
        icon: '📝',
        desc: 'Start with an empty note',
        content: '<p></p>'
    }
];

// ─── Welcome Note ──────────────────────────────────────────────
function getWelcomeContent() {
    return `<h1>Welcome to NoteForge! 🚀</h1>
<p>Your developer-focused note-taking powerhouse. Here's a quick tour of what you can do:</p>

<h2>⌨️ Keyboard-First Design</h2>
<p>Press <code>Ctrl+Shift+?</code> to see all shortcuts, or <code>Ctrl+K</code> to open the command palette.</p>

<h2>✍️ Rich Formatting</h2>
<p>Use toolbar buttons or keyboard shortcuts:</p>
<ul>
<li><strong>Bold</strong> — <code>Ctrl+B</code></li>
<li><em>Italic</em> — <code>Ctrl+I</code></li>
<li><u>Underline</u> — <code>Ctrl+U</code></li>
<li><s>Strikethrough</s> — <code>Ctrl+Shift+S</code></li>
<li><mark>Highlight</mark> — <code>Ctrl+Shift+H</code></li>
<li><code>Inline Code</code> — <code>Ctrl+\`</code></li>
</ul>

<h2>📝 Markdown Shortcuts</h2>
<p>Type these at the start of a line:</p>
<ul>
<li><code># </code> / <code>## </code> / <code>### </code> — Headings</li>
<li><code>- </code> — Bullet list</li>
<li><code>1. </code> — Numbered list</li>
<li><code>[] </code> — Todo checkbox</li>
<li><code>> </code> — Blockquote</li>
<li><code>\`\`\`</code> — Code block</li>
<li><code>---</code> — Horizontal rule</li>
</ul>

<h2>☑️ Todo Lists</h2>
<p>Press <code>Ctrl+Shift+9</code> or type <code>[] </code> to create checkboxes:</p>
<div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Click the checkbox to complete</span></div>
<div class="todo-item checked"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">This one is done!</span></div>
<div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">Press Enter on a todo to add another</span></div>

<h2>💻 Code Blocks</h2>
<p>Press <code>Ctrl+Shift+E</code> or type <code>\`\`\`</code> for syntax-highlighted code:</p>
<div class="code-block-wrap" contenteditable="false"><div class="code-block-header"><select onchange="app.onCodeLangChange(this)"><option value="javascript" selected>javascript</option><option value="typescript">typescript</option><option value="python">python</option><option value="csharp">csharp</option><option value="html">html</option><option value="css">css</option><option value="json">json</option><option value="sql">sql</option><option value="bash">bash</option><option value="plaintext">plaintext</option></select><div class="code-block-actions"><button class="copy-code-btn" onclick="app.copyCodeBlock(this)">Copy</button><button class="delete-block-btn" onclick="app.deleteBlock(this.closest('.code-block-wrap'))" title="Delete code block">✕</button></div></div><textarea class="code-textarea" spellcheck="false" placeholder="Type or paste code here...">// Your code goes here
function greet(name) {
    return \`Hello, \${name}! Welcome to NoteForge.\`;
}</textarea></div>

<h2>🖼️ Images</h2>
<p>Paste images directly from your clipboard (<code>Ctrl+V</code>) or drag & drop them into the editor. Screenshots work perfectly!</p>

<h2>🏷️ Tags & Organization</h2>
<p>Add tags at the bottom of any note to categorize them. Pin important notes to keep them at the top of the sidebar.</p>

<h2>🔍 Search & Commands</h2>
<ul>
<li><code>Ctrl+K</code> — Command palette (search commands)</li>
<li><code>Ctrl+Shift+F</code> — Search across all notes</li>
</ul>

<h2>📋 Templates</h2>
<p>Click the template button in the sidebar to create notes from pre-built templates: Meeting Notes, Daily Standup, Bug Reports, and more.</p>

<h2>🌓 Themes</h2>
<p>Toggle between dark and light mode with <code>Ctrl+Shift+D</code>.</p>

<h2>🧘 Zen Mode</h2>
<p>Press <code>F11</code> for distraction-free writing. The toolbar appears on hover.</p>

<hr>
<p><em>All your notes are saved automatically to your browser's local storage. Happy noting! ✨</em></p>`;
}

// ─── Main Application ──────────────────────────────────────────
class App {
    constructor() {
        this.storage = new StorageManager();
        this.notes = this.storage.getNotes();
        this.settings = {
            theme: 'dark',
            activeNoteId: null,
            sidebarCollapsed: false,
            ...this.storage.getSettings()
        };
        this.activeNoteId = null;
        this.isZen = false;
        this.selectedCommandIndex = 0;
        this.filteredCommands = [];

        this.initElements();
        this.initTheme();
        this.initEvents();
        this.initCommands();
        this.initTemplates();

        // Create welcome note if no notes exist
        if (Object.keys(this.notes).length === 0) {
            this.createNote('Welcome to NoteForge', getWelcomeContent(), ['welcome', 'guide']);
        }

        this.renderNotesList();
        this.loadNote(this.settings.activeNoteId || Object.keys(this.notes)[0]);
        this.updateStorageMeter();
    }

    initElements() {
        // Sidebar
        this.sidebar = document.getElementById('sidebar');
        this.notesList = document.getElementById('notesList');
        this.newNoteBtn = document.getElementById('newNoteBtn');
        this.sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
        this.sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
        this.searchBtn = document.getElementById('searchBtn');
        this.themeBtn = document.getElementById('themeBtn');
        this.shortcutsBtn = document.getElementById('shortcutsBtn');
        this.templateBtn = document.getElementById('templateBtn');
        this.storageFill = document.getElementById('storageFill');
        this.storageText = document.getElementById('storageText');

        // Editor
        this.editor = document.getElementById('editor');
        this.noteTitleInput = document.getElementById('noteTitleInput');
        this.toolbar = document.getElementById('toolbar');
        this.appLayout = document.getElementById('appLayout');

        // Header actions
        this.pinBtn = document.getElementById('pinBtn');
        this.zenBtn = document.getElementById('zenBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.deleteBtn = document.getElementById('deleteBtn');

        // Tags
        this.tagsList = document.getElementById('tagsList');
        this.tagInput = document.getElementById('tagInput');

        // Status bar
        this.statusSave = document.getElementById('statusSave');
        this.statusDate = document.getElementById('statusDate');
        this.statusWords = document.getElementById('statusWords');
        this.statusChars = document.getElementById('statusChars');

        // Modals
        this.commandPalette = document.getElementById('commandPalette');
        this.commandInput = document.getElementById('commandInput');
        this.commandList = document.getElementById('commandList');

        this.searchModal = document.getElementById('searchModal');
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = document.getElementById('searchResults');

        this.shortcutsModal = document.getElementById('shortcutsModal');
        this.exportModal = document.getElementById('exportModal');
        this.templateModal = document.getElementById('templateModal');

        // Toast
        this.toastContainer = document.getElementById('toastContainer');
    }

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        this.updateHljsTheme();
        if (this.settings.sidebarCollapsed) {
            this.sidebar.classList.add('collapsed');
        }
    }

    updateHljsTheme() {
        const link = document.getElementById('hljs-theme');
        if (this.settings.theme === 'dark') {
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
        } else {
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        }
    }

    // ─── Event Binding ─────────────────────────────────────
    initEvents() {
        // Sidebar buttons
        this.newNoteBtn.addEventListener('click', () => this.createNote());
        this.sidebarCollapseBtn.addEventListener('click', () => this.toggleSidebar());
        this.sidebarExpandBtn.addEventListener('click', () => this.toggleSidebar());
        this.searchBtn.addEventListener('click', () => this.openSearchModal());
        this.themeBtn.addEventListener('click', () => this.toggleTheme());
        this.shortcutsBtn.addEventListener('click', () => this.openModal(this.shortcutsModal));
        this.templateBtn.addEventListener('click', () => this.openModal(this.templateModal));

        // Header actions
        this.pinBtn.addEventListener('click', () => this.togglePin());
        this.zenBtn.addEventListener('click', () => this.toggleZenMode());
        this.exportBtn.addEventListener('click', () => this.openModal(this.exportModal));
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentNote());

        // Title input
        this.noteTitleInput.addEventListener('input', () => this.onTitleChange());
        this.noteTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.editor.focus(); }
        });

        // Editor events
        this.editor.addEventListener('input', () => this.onEditorInput());
        this.editor.addEventListener('keydown', (e) => this.onEditorKeydown(e));
        this.editor.addEventListener('paste', (e) => this.onPaste(e));
        this.editor.addEventListener('click', (e) => this.onEditorClick(e));



        // Drag and drop for images
        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.editor.classList.add('drag-over');
        });
        this.editor.addEventListener('dragleave', () => {
            this.editor.classList.remove('drag-over');
        });
        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            this.editor.classList.remove('drag-over');
            this.handleImageDrop(e);
        });

        // Tags
        this.tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.tagInput.value.trim()) {
                e.preventDefault();
                this.addTag(this.tagInput.value.trim());
                this.tagInput.value = '';
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onGlobalKeydown(e));

        // Command palette
        this.commandInput.addEventListener('input', () => this.filterCommands());
        this.commandInput.addEventListener('keydown', (e) => this.onCommandKeydown(e));

        // Search
        this.searchInput.addEventListener('input', debounce(() => this.performSearch(), 200));
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });

        // Modal close handlers
        [this.commandPalette, this.searchModal, this.shortcutsModal, this.exportModal, this.templateModal].forEach(modal => {
            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });

        document.getElementById('closeShortcuts').addEventListener('click', () => this.closeAllModals());
        document.getElementById('closeExport').addEventListener('click', () => this.closeAllModals());
        document.getElementById('closeTemplate').addEventListener('click', () => this.closeAllModals());

        // Export options
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exportNote(btn.dataset.format);
                this.closeAllModals();
            });
        });

        // Import
        document.getElementById('importMdBtn').addEventListener('click', () => this.triggerImport());
        document.getElementById('importFileInput').addEventListener('change', (e) => this.handleImportFile(e));

        // Toolbar buttons
        this.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent losing focus
            });
            btn.addEventListener('click', () => {
                this.execToolbarCommand(btn.dataset.command);
            });
        });

        // Auto-save
        this.debouncedSave = debounce(() => this.saveCurrentNote(), 800);

        // Update toolbar state on selection change
        document.addEventListener('selectionchange', () => this.updateToolbarState());

        // Window beforeunload - save
        window.addEventListener('beforeunload', () => this.saveCurrentNote());
    }

    // ─── Commands Registry ─────────────────────────────────
    initCommands() {
        this.commands = [
            { label: 'New Note', icon: '📝', shortcut: 'Ctrl+N', action: () => this.createNote(), category: 'Notes' },
            { label: 'New from Template', icon: '📋', shortcut: '', action: () => { this.closeAllModals(); setTimeout(() => this.openModal(this.templateModal), 100); }, category: 'Notes' },
            { label: 'Delete Note', icon: '🗑️', shortcut: '', action: () => this.deleteCurrentNote(), category: 'Notes' },
            { label: 'Pin / Unpin Note', icon: '📌', shortcut: 'Ctrl+Shift+P', action: () => this.togglePin(), category: 'Notes' },
            { label: 'Duplicate Note', icon: '📄', shortcut: '', action: () => this.duplicateNote(), category: 'Notes' },
            { label: 'Export Note', icon: '📤', shortcut: '', action: () => { this.closeAllModals(); setTimeout(() => this.openModal(this.exportModal), 100); }, category: 'Notes' },
            { label: 'Import Markdown', icon: '📥', shortcut: '', action: () => { this.closeAllModals(); this.triggerImport(); }, category: 'Notes' },
            { label: 'Search All Notes', icon: '🔍', shortcut: 'Ctrl+Shift+F', action: () => { this.closeAllModals(); setTimeout(() => this.openSearchModal(), 100); }, category: 'Navigation' },
            { label: 'Toggle Sidebar', icon: '📐', shortcut: 'Ctrl+\\', action: () => this.toggleSidebar(), category: 'View' },
            { label: 'Toggle Dark/Light Theme', icon: '🌓', shortcut: 'Ctrl+Shift+D', action: () => this.toggleTheme(), category: 'View' },
            { label: 'Zen Mode', icon: '🧘', shortcut: 'F11', action: () => this.toggleZenMode(), category: 'View' },
            { label: 'Show Keyboard Shortcuts', icon: '⌨️', shortcut: 'Ctrl+Shift+?', action: () => { this.closeAllModals(); setTimeout(() => this.openModal(this.shortcutsModal), 100); }, category: 'Help' },
            { label: 'Bold', icon: '𝐁', shortcut: 'Ctrl+B', action: () => this.execFormat('bold'), category: 'Format' },
            { label: 'Italic', icon: '𝐼', shortcut: 'Ctrl+I', action: () => this.execFormat('italic'), category: 'Format' },
            { label: 'Underline', icon: 'U̲', shortcut: 'Ctrl+U', action: () => this.execFormat('underline'), category: 'Format' },
            { label: 'Strikethrough', icon: 'S̶', shortcut: 'Ctrl+Shift+S', action: () => this.execFormat('strikeThrough'), category: 'Format' },
            { label: 'Highlight', icon: '🖍️', shortcut: 'Ctrl+Shift+H', action: () => this.execHighlight(), category: 'Format' },
            { label: 'Inline Code', icon: '<>', shortcut: 'Ctrl+`', action: () => this.execInlineCode(), category: 'Format' },
            { label: 'Heading 1', icon: 'H1', shortcut: 'Ctrl+Shift+1', action: () => this.execFormat('formatBlock', '<h1>'), category: 'Format' },
            { label: 'Heading 2', icon: 'H2', shortcut: 'Ctrl+Shift+2', action: () => this.execFormat('formatBlock', '<h2>'), category: 'Format' },
            { label: 'Heading 3', icon: 'H3', shortcut: 'Ctrl+Shift+3', action: () => this.execFormat('formatBlock', '<h3>'), category: 'Format' },
            { label: 'Bullet List', icon: '•', shortcut: 'Ctrl+Shift+8', action: () => this.execFormat('insertUnorderedList'), category: 'Format' },
            { label: 'Numbered List', icon: '1.', shortcut: 'Ctrl+Shift+7', action: () => this.execFormat('insertOrderedList'), category: 'Format' },
            { label: 'Todo / Checkbox', icon: '☑', shortcut: 'Ctrl+Shift+9', action: () => this.insertTodo(), category: 'Insert' },
            { label: 'Code Block', icon: '{ }', shortcut: 'Ctrl+Shift+E', action: () => this.insertCodeBlock(), category: 'Insert' },
            { label: 'Blockquote', icon: '❝', shortcut: 'Ctrl+Shift+.', action: () => this.execFormat('formatBlock', '<blockquote>'), category: 'Format' },
            { label: 'Horizontal Rule', icon: '─', shortcut: 'Ctrl+Enter', action: () => this.insertHorizontalRule(), category: 'Insert' },
            { label: 'Insert Link', icon: '🔗', shortcut: 'Ctrl+Shift+K', action: () => this.insertLink(), category: 'Insert' },
            { label: 'Insert Table', icon: '⊞', shortcut: '', action: () => this.insertTable(), category: 'Insert' },
            { label: 'Insert Timestamp', icon: '🕐', shortcut: 'Ctrl+Shift+T', action: () => this.insertTimestamp(), category: 'Insert' },
            { label: 'Clear Formatting', icon: '✕', shortcut: '', action: () => this.execFormat('removeFormat'), category: 'Format' },
            { label: 'Normal Paragraph', icon: '¶', shortcut: '', action: () => this.execFormat('formatBlock', '<p>'), category: 'Format' },
        ];

        // Add note-switching commands
        this.updateNoteCommands();
    }

    updateNoteCommands() {
        // Remove old note switch commands
        this.commands = this.commands.filter(c => c.category !== 'Switch To');
        // Add current notes
        Object.values(this.notes).forEach(note => {
            this.commands.push({
                label: note.title || 'Untitled',
                icon: note.pinned ? '📌' : '📄',
                shortcut: '',
                action: () => this.loadNote(note.id),
                category: 'Switch To'
            });
        });
    }

    initTemplates() {
        const container = document.getElementById('templateList');
        container.innerHTML = TEMPLATES.map((t, i) => `
            <button class="template-item" data-index="${i}">
                <span class="template-item-icon">${t.icon}</span>
                <div class="template-item-info">
                    <div class="template-item-title">${t.name}</div>
                    <div class="template-item-desc">${t.desc}</div>
                </div>
            </button>
        `).join('');

        container.querySelectorAll('.template-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const template = TEMPLATES[parseInt(btn.dataset.index)];
                this.createNote(template.name, template.content);
                this.closeAllModals();
            });
        });
    }

    // ─── Note CRUD ─────────────────────────────────────────
    createNote(title = 'Untitled Note', content = '<p></p>', tags = []) {
        const id = uuid();
        const now = new Date().toISOString();
        this.notes[id] = {
            id,
            title,
            content,
            tags,
            pinned: false,
            createdAt: now,
            updatedAt: now
        };
        this.storage.saveNotes(this.notes);
        this.updateNoteCommands();
        this.renderNotesList();
        this.loadNote(id);
        this.updateStorageMeter();
        this.showToast('Note created', '✨');
        return id;
    }

    saveCurrentNote() {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const note = this.notes[this.activeNoteId];
        // Sync textarea values so they persist in innerHTML
        this.editor.querySelectorAll('.code-textarea').forEach(ta => {
            ta.textContent = ta.value;
        });
        // Clone editor content and strip ephemeral UI buttons before saving
        const clone = this.editor.cloneNode(true);
        clone.querySelectorAll('.blockquote-delete-btn').forEach(el => el.remove());
        note.content = clone.innerHTML;
        note.title = this.noteTitleInput.value || 'Untitled Note';
        note.updatedAt = new Date().toISOString();
        this.storage.saveNotes(this.notes);
        this.settings.activeNoteId = this.activeNoteId;
        this.storage.saveSettings(this.settings);
        this.statusSave.textContent = 'Saved';
        this.statusSave.className = 'status-item save-status';
        this.updateStorageMeter();
        this.renderNotesList();
    }

    loadNote(id) {
        if (!id || !this.notes[id]) {
            const keys = Object.keys(this.notes);
            if (keys.length === 0) {
                id = this.createNote();
            } else {
                id = keys[0];
            }
        }
        // Save current note first
        if (this.activeNoteId && this.notes[this.activeNoteId]) {
            this.editor.querySelectorAll('.code-textarea').forEach(ta => {
                ta.textContent = ta.value;
            });
            this.notes[this.activeNoteId].content = this.editor.innerHTML;
            this.notes[this.activeNoteId].title = this.noteTitleInput.value || 'Untitled Note';
        }

        this.activeNoteId = id;
        const note = this.notes[id];
        this.noteTitleInput.value = note.title;
        this.editor.innerHTML = note.content;
        this.renderTags();
        this.updatePinButton();
        this.updateStatus();
        this.renderNotesList();

        this.settings.activeNoteId = id;
        this.storage.saveSettings(this.settings);

        setTimeout(() => {
            this.ensureBlockquoteDeleteButtons();
            this.migrateCodeBlocks();
            this.setupAllCodeTextareas();
        }, 50);
    }

    deleteCurrentNote() {
        if (!this.activeNoteId) return;
        const noteTitle = this.notes[this.activeNoteId]?.title || 'Untitled';
        if (!confirm(`Delete "${noteTitle}"?`)) return;

        delete this.notes[this.activeNoteId];
        this.storage.saveNotes(this.notes);
        this.updateNoteCommands();

        const keys = Object.keys(this.notes);
        if (keys.length === 0) {
            this.activeNoteId = null;
            this.createNote();
        } else {
            this.loadNote(keys[0]);
        }
        this.renderNotesList();
        this.updateStorageMeter();
        this.showToast('Note deleted', '🗑️');
    }

    duplicateNote() {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const src = this.notes[this.activeNoteId];
        this.createNote(src.title + ' (copy)', src.content, [...src.tags]);
    }

    togglePin() {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        this.notes[this.activeNoteId].pinned = !this.notes[this.activeNoteId].pinned;
        this.saveCurrentNote();
        this.updatePinButton();
        this.renderNotesList();
        this.showToast(this.notes[this.activeNoteId].pinned ? 'Note pinned' : 'Note unpinned', '📌');
    }

    updatePinButton() {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        this.pinBtn.classList.toggle('active', this.notes[this.activeNoteId].pinned);
    }

    // ─── Sidebar Rendering ─────────────────────────────────
    renderNotesList() {
        const notes = Object.values(this.notes);
        const pinned = notes.filter(n => n.pinned).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const unpinned = notes.filter(n => !n.pinned).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        let html = '';

        if (pinned.length > 0) {
            html += '<div class="notes-list-section">Pinned</div>';
            html += pinned.map(n => this.renderNoteItem(n)).join('');
        }

        if (unpinned.length > 0) {
            if (pinned.length > 0) html += '<div class="notes-list-section">Notes</div>';
            html += unpinned.map(n => this.renderNoteItem(n)).join('');
        }

        this.notesList.innerHTML = html;

        // Bind click events
        this.notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => this.loadNote(item.dataset.id));
        });
    }

    renderNoteItem(note) {
        const isActive = note.id === this.activeNoteId;
        const preview = stripHtml(note.content).substring(0, 80);
        const pinIcon = note.pinned ? '<svg class="note-item-pin" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M15 4.5L18.5 8 14.5 12.5 17.5 15.5 12 21 8.5 17.5 4 13 7.5 9.5 12 5.5z"/></svg>' : '';
        const tags = note.tags.length > 0 ? `<div class="note-item-tags">${note.tags.slice(0, 3).map(t => `<span class="note-item-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';

        return `<div class="note-item ${isActive ? 'active' : ''}" data-id="${note.id}">
            ${pinIcon}
            <div class="note-item-content">
                <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-preview">${escapeHtml(preview)}</div>
                <div class="note-item-date">${formatDate(note.updatedAt)}</div>
                ${tags}
            </div>
        </div>`;
    }

    // ─── Tags ──────────────────────────────────────────────
    addTag(tag) {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const note = this.notes[this.activeNoteId];
        tag = tag.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
        if (!tag || note.tags.includes(tag)) return;
        note.tags.push(tag);
        this.saveCurrentNote();
        this.renderTags();
    }

    removeTag(tag) {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const note = this.notes[this.activeNoteId];
        note.tags = note.tags.filter(t => t !== tag);
        this.saveCurrentNote();
        this.renderTags();
    }

    renderTags() {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const tags = this.notes[this.activeNoteId].tags || [];
        this.tagsList.innerHTML = tags.map(t =>
            `<span class="tag">${escapeHtml(t)}<button class="tag-remove" data-tag="${escapeHtml(t)}">&times;</button></span>`
        ).join('');
        this.tagsList.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', () => this.removeTag(btn.dataset.tag));
        });
    }

    // ─── Editor Events ─────────────────────────────────────
    onTitleChange() {
        this.statusSave.textContent = 'Editing...';
        this.statusSave.className = 'status-item save-status unsaved';
        this.debouncedSave();
    }

    onEditorInput() {
        this.statusSave.textContent = 'Editing...';
        this.statusSave.className = 'status-item save-status unsaved';
        this.updateStatus();
        this.debouncedSave();
        // Ensure blockquotes have delete buttons
        this.ensureBlockquoteDeleteButtons();
    }

    onEditorClick(e) {
        // Handle todo checkbox clicks
        const checkbox = e.target.closest('.todo-checkbox');
        if (checkbox) {
            e.preventDefault();
            const todoItem = checkbox.closest('.todo-item');
            if (todoItem) {
                todoItem.classList.toggle('checked');
                this.debouncedSave();
            }
        }

        // Handle blockquote delete button
        const bqDelete = e.target.closest('.blockquote-delete-btn');
        if (bqDelete) {
            e.preventDefault();
            const bq = bqDelete.closest('blockquote');
            if (bq) this.deleteBlock(bq);
        }
    }

    onEditorKeydown(e) {
        // Handle markdown shortcuts on space
        if (e.key === ' ' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (this.handleMarkdownShortcut()) {
                e.preventDefault();
                return;
            }
        }

        // Handle Enter in todo items
        if (e.key === 'Enter' && !e.shiftKey) {
            const todoItem = this.getParentElement('.todo-item');
            if (todoItem) {
                e.preventDefault();
                this.handleTodoEnter(todoItem);
                return;
            }
        }

        // Handle Backspace in empty todo items
        if (e.key === 'Backspace') {
            const todoItem = this.getParentElement('.todo-item');
            if (todoItem) {
                const textEl = todoItem.querySelector('.todo-text');
                if (textEl && textEl.textContent === '') {
                    e.preventDefault();
                    this.removeTodoItem(todoItem);
                    return;
                }
            }
        }

        // Handle ``` for code blocks
        if (e.key === '`') {
            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                const text = node.textContent || '';
                const offset = range.startOffset;
                const beforeCursor = text.substring(0, offset);
                if (beforeCursor.endsWith('``')) {
                    e.preventDefault();
                    // Remove the backticks
                    const textBefore = text.substring(0, offset - 2);
                    const textAfter = text.substring(offset);
                    node.textContent = textBefore + textAfter;
                    // Remove the current block if empty
                    const block = this.getCurrentBlock();
                    if (block && block.textContent.trim() === '') {
                        block.remove();
                    }
                    this.insertCodeBlock();
                    return;
                }
            }
        }

        // Handle --- for horizontal rule
        if (e.key === '-') {
            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                const text = node.textContent || '';
                const offset = range.startOffset;
                const beforeCursor = text.substring(0, offset);
                if (beforeCursor === '--' && text.trim() === '--') {
                    e.preventDefault();
                    const block = this.getCurrentBlock();
                    if (block) block.remove();
                    this.insertHorizontalRule();
                    return;
                }
            }
        }

        // Tab / Shift+Tab for indent/outdent
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                document.execCommand('outdent', false, null);
            } else {
                document.execCommand('indent', false, null);
            }
            return;
        }

        // Ctrl+Enter for horizontal rule
        if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            this.insertHorizontalRule();
            return;
        }
    }

    onGlobalKeydown(e) {
        const ctrl = e.ctrlKey || e.metaKey;

        // Escape - close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
            return;
        }

        // Ctrl+K - Command palette
        if (ctrl && e.key === 'k') {
            e.preventDefault();
            this.openCommandPalette();
            return;
        }

        // Ctrl+N - New note
        if (ctrl && e.key === 'n') {
            e.preventDefault();
            this.createNote();
            return;
        }

        // Ctrl+S - Save
        if (ctrl && e.key === 's') {
            e.preventDefault();
            this.saveCurrentNote();
            this.showToast('Note saved', '💾');
            return;
        }

        // Ctrl+Shift+F - Search
        if (ctrl && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            this.openSearchModal();
            return;
        }

        // Ctrl+\ - Toggle sidebar
        if (ctrl && e.key === '\\') {
            e.preventDefault();
            this.toggleSidebar();
            return;
        }

        // Ctrl+Shift+D - Theme toggle
        if (ctrl && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            this.toggleTheme();
            return;
        }

        // F11 - Zen mode
        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleZenMode();
            return;
        }

        // Ctrl+Shift+? - Shortcuts
        if (ctrl && e.shiftKey && (e.key === '?' || e.key === '/')) {
            e.preventDefault();
            this.openModal(this.shortcutsModal);
            return;
        }

        // Ctrl+Shift+P - Pin
        if (ctrl && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            this.togglePin();
            return;
        }

        // Only process editor shortcuts when editor is focused
        if (!this.editor.contains(document.activeElement) && document.activeElement !== this.editor) return;

        // Ctrl+Shift+S - Strikethrough
        if (ctrl && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            this.execFormat('strikeThrough');
            return;
        }

        // Ctrl+Shift+H - Highlight
        if (ctrl && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            this.execHighlight();
            return;
        }

        // Ctrl+` - Inline code
        if (ctrl && e.key === '`') {
            e.preventDefault();
            this.execInlineCode();
            return;
        }

        // Ctrl+Shift+1/2/3 - Headings
        if (ctrl && e.shiftKey && e.key === '!') { e.preventDefault(); this.execFormat('formatBlock', '<h1>'); return; }
        if (ctrl && e.shiftKey && e.key === '@') { e.preventDefault(); this.execFormat('formatBlock', '<h2>'); return; }
        if (ctrl && e.shiftKey && e.key === '#') { e.preventDefault(); this.execFormat('formatBlock', '<h3>'); return; }

        // Ctrl+Shift+7 - Ordered list
        if (ctrl && e.shiftKey && e.key === '&') { e.preventDefault(); this.execFormat('insertOrderedList'); return; }
        // Ctrl+Shift+8 - Unordered list
        if (ctrl && e.shiftKey && e.key === '*') { e.preventDefault(); this.execFormat('insertUnorderedList'); return; }
        // Ctrl+Shift+9 - Todo
        if (ctrl && e.shiftKey && e.key === '(') { e.preventDefault(); this.insertTodo(); return; }

        // Ctrl+Shift+E - Code block
        if (ctrl && e.shiftKey && e.key === 'E') { e.preventDefault(); this.insertCodeBlock(); return; }

        // Ctrl+Shift+. - Blockquote
        if (ctrl && e.shiftKey && e.key === '>') { e.preventDefault(); this.execFormat('formatBlock', '<blockquote>'); return; }

        // Ctrl+Shift+K - Link
        if (ctrl && e.shiftKey && e.key === 'K') { e.preventDefault(); this.insertLink(); return; }

        // Ctrl+Shift+T - Timestamp
        if (ctrl && e.shiftKey && e.key === 'T') { e.preventDefault(); this.insertTimestamp(); return; }
    }

    // ─── Formatting Commands ───────────────────────────────
    execFormat(command, value = null) {
        this.editor.focus();
        document.execCommand(command, false, value);
        this.updateToolbarState();
        this.debouncedSave();
    }

    execToolbarCommand(command) {
        switch (command) {
            case 'bold': this.execFormat('bold'); break;
            case 'italic': this.execFormat('italic'); break;
            case 'underline': this.execFormat('underline'); break;
            case 'strikeThrough': this.execFormat('strikeThrough'); break;
            case 'highlight': this.execHighlight(); break;
            case 'inlineCode': this.execInlineCode(); break;
            case 'h1': this.execFormat('formatBlock', '<h1>'); break;
            case 'h2': this.execFormat('formatBlock', '<h2>'); break;
            case 'h3': this.execFormat('formatBlock', '<h3>'); break;
            case 'insertUnorderedList': this.execFormat('insertUnorderedList'); break;
            case 'insertOrderedList': this.execFormat('insertOrderedList'); break;
            case 'todo': this.insertTodo(); break;
            case 'codeBlock': this.insertCodeBlock(); break;
            case 'blockquote': this.execFormat('formatBlock', '<blockquote>'); break;
            case 'hr': this.insertHorizontalRule(); break;
            case 'link': this.insertLink(); break;
            case 'table': this.insertTable(); break;
        }
    }

    execHighlight() {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return;

        const range = sel.getRangeAt(0);
        // Check if already highlighted
        const parent = range.commonAncestorContainer.parentElement;
        if (parent && parent.tagName === 'MARK') {
            // Remove highlight
            const text = document.createTextNode(parent.textContent);
            parent.parentNode.replaceChild(text, parent);
        } else {
            const mark = document.createElement('mark');
            try {
                range.surroundContents(mark);
            } catch {
                // fallback for complex selections
                document.execCommand('hiliteColor', false, '#3d3510');
            }
        }
        this.debouncedSave();
    }

    execInlineCode() {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) {
            // Insert empty code element
            document.execCommand('insertHTML', false, '<code>&nbsp;</code>&nbsp;');
            return;
        }

        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer.parentElement;
        if (parent && parent.tagName === 'CODE' && !parent.closest('pre')) {
            // Remove code formatting
            const text = document.createTextNode(parent.textContent);
            parent.parentNode.replaceChild(text, parent);
        } else {
            const code = document.createElement('code');
            try {
                range.surroundContents(code);
            } catch {
                const text = sel.toString();
                document.execCommand('insertHTML', false, `<code>${escapeHtml(text)}</code>`);
            }
        }
        this.debouncedSave();
    }

    updateToolbarState() {
        if (!this.editor.contains(document.activeElement) && document.activeElement !== this.editor) return;

        const commands = {
            'bold': 'bold',
            'italic': 'italic',
            'underline': 'underline',
            'strikeThrough': 'strikeThrough'
        };

        Object.entries(commands).forEach(([cmd, qCmd]) => {
            const btn = this.toolbar.querySelector(`[data-command="${cmd}"]`);
            if (btn) {
                btn.classList.toggle('active', document.queryCommandState(qCmd));
            }
        });
    }

    // ─── Special Insertions ────────────────────────────────
    insertTodo() {
        this.editor.focus();
        const html = `<div class="todo-item"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">&nbsp;</span></div>`;
        document.execCommand('insertHTML', false, html);
        // Focus the todo text
        setTimeout(() => {
            const todos = this.editor.querySelectorAll('.todo-text');
            const last = todos[todos.length - 1];
            if (last) {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(last);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }, 10);
        this.debouncedSave();
    }

    handleTodoEnter(todoItem) {
        const textEl = todoItem.querySelector('.todo-text');
        if (!textEl) return;

        // If empty todo, convert to paragraph
        if (textEl.textContent.trim() === '') {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            todoItem.parentNode.insertBefore(p, todoItem.nextSibling);
            todoItem.remove();
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Split text at cursor and create new todo
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        // Get text after cursor
        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEndAfter(textEl.lastChild || textEl);
        const afterContent = afterRange.cloneContents();
        afterRange.deleteContents();

        // Create new todo
        const newTodo = document.createElement('div');
        newTodo.className = 'todo-item';
        newTodo.innerHTML = '<span class="todo-checkbox" contenteditable="false"></span><span class="todo-text"></span>';
        const newText = newTodo.querySelector('.todo-text');

        if (afterContent.textContent.trim()) {
            newText.appendChild(afterContent);
        } else {
            newText.innerHTML = '&nbsp;';
        }

        todoItem.parentNode.insertBefore(newTodo, todoItem.nextSibling);

        // Set cursor to new todo
        const newRange = document.createRange();
        const newSel = window.getSelection();
        newRange.setStart(newText, 0);
        newRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(newRange);
    }

    removeTodoItem(todoItem) {
        const prev = todoItem.previousElementSibling;
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        todoItem.parentNode.insertBefore(p, todoItem);
        todoItem.remove();

        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    insertCodeBlock() {
        this.editor.focus();
        const languages = ['plaintext', 'javascript', 'typescript', 'python', 'csharp', 'java',
            'html', 'css', 'json', 'sql', 'bash', 'powershell', 'go', 'rust', 'cpp', 'ruby', 'php', 'yaml', 'xml', 'markdown'];
        const options = languages.map(l => `<option value="${l}">${l}</option>`).join('');

        const html = `<div class="code-block-wrap" contenteditable="false"><div class="code-block-header"><select onchange="app.onCodeLangChange(this)">${options}</select><div class="code-block-actions"><button class="copy-code-btn" onclick="app.copyCodeBlock(this)">Copy</button><button class="delete-block-btn" onclick="app.deleteBlock(this.closest('.code-block-wrap'))" title="Delete code block">✕</button></div></div><textarea class="code-textarea" spellcheck="false" placeholder="Type or paste code here..."></textarea></div><p><br></p>`;

        document.execCommand('insertHTML', false, html);

        // Focus the textarea
        setTimeout(() => {
            const textareas = this.editor.querySelectorAll('.code-block-wrap .code-textarea');
            const last = textareas[textareas.length - 1];
            if (last) {
                this.setupCodeTextarea(last);
                last.focus();
            }
        }, 10);
        this.debouncedSave();
    }

    insertHorizontalRule() {
        this.editor.focus();
        document.execCommand('insertHTML', false, '<hr><p><br></p>');
        this.debouncedSave();
    }

    insertLink() {
        const sel = window.getSelection();
        const selectedText = sel.toString();
        const url = prompt('Enter URL:', 'https://');
        if (!url) return;
        this.editor.focus();
        if (selectedText) {
            document.execCommand('createLink', false, url);
        } else {
            const text = prompt('Link text:', url);
            document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(text || url)}</a>`);
        }
        this.debouncedSave();
    }

    insertTable() {
        const rows = parseInt(prompt('Number of rows:', '3')) || 3;
        const cols = parseInt(prompt('Number of columns:', '3')) || 3;

        let html = '<table><thead><tr>';
        for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows - 1; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) html += '<td></td>';
            html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';

        this.editor.focus();
        document.execCommand('insertHTML', false, html);
        this.debouncedSave();
    }

    insertTimestamp() {
        this.editor.focus();
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        document.execCommand('insertHTML', false, `<strong>[${timestamp}]</strong> `);
        this.debouncedSave();
    }

    // ─── Markdown Shortcuts ────────────────────────────────
    handleMarkdownShortcut() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return false;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return false;

        const text = node.textContent;
        const offset = range.startOffset;
        const lineBefore = text.substring(0, offset);

        // # Heading 1
        if (lineBefore === '#') {
            this.replaceLineWithBlock(node, offset, 1, 'h1');
            return true;
        }
        // ## Heading 2
        if (lineBefore === '##') {
            this.replaceLineWithBlock(node, offset, 2, 'h2');
            return true;
        }
        // ### Heading 3
        if (lineBefore === '###') {
            this.replaceLineWithBlock(node, offset, 3, 'h3');
            return true;
        }
        // - Bullet list
        if (lineBefore === '-' || lineBefore === '*') {
            this.replaceTextAndExec(node, offset, 1, 'insertUnorderedList');
            return true;
        }
        // 1. Ordered list
        if (/^\d+\.$/.test(lineBefore)) {
            this.replaceTextAndExec(node, offset, lineBefore.length, 'insertOrderedList');
            return true;
        }
        // [] or [ ] Todo
        if (lineBefore === '[]' || lineBefore === '[ ]') {
            const block = this.getCurrentBlock();
            node.textContent = text.substring(offset);
            if (block && block.textContent.trim() === '') block.remove();
            this.insertTodo();
            return true;
        }
        // > Blockquote
        if (lineBefore === '>') {
            this.replaceLineWithBlock(node, offset, 1, 'blockquote');
            return true;
        }

        return false;
    }

    replaceLineWithBlock(node, offset, removeChars, tag) {
        const text = node.textContent;
        const after = text.substring(offset);
        node.textContent = after;
        document.execCommand('formatBlock', false, `<${tag}>`);
    }

    replaceTextAndExec(node, offset, removeChars, command) {
        const text = node.textContent;
        node.textContent = text.substring(offset);
        document.execCommand(command, false, null);
    }

    // ─── Paste Handler (Images) ────────────────────────────
    onPaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) this.insertImage(file);
                return;
            }
        }

        // For text paste, let browser handle it but clean up
        // We intercept HTML paste only to sanitize
        if (e.clipboardData.types.includes('text/html')) {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            const cleaned = this.sanitizeHtml(html);
            document.execCommand('insertHTML', false, cleaned);
        }
    }

    sanitizeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;

        // Remove scripts
        div.querySelectorAll('script, style, meta, link').forEach(el => el.remove());

        // Remove unwanted attributes but keep essentials
        div.querySelectorAll('*').forEach(el => {
            const allowed = ['href', 'src', 'alt', 'class', 'colspan', 'rowspan'];
            [...el.attributes].forEach(attr => {
                if (!allowed.includes(attr.name) && !attr.name.startsWith('data-')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return div.innerHTML;
    }

    handleImageDrop(e) {
        const files = e.dataTransfer?.files;
        if (!files) return;
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                this.insertImage(file);
            }
        }
    }

    insertImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Compress image
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const MAX_SIZE = 1200;

                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) {
                        height = (height / width) * MAX_SIZE;
                        width = MAX_SIZE;
                    } else {
                        width = (width / height) * MAX_SIZE;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Use JPEG for photos (smaller), PNG for screenshots
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                this.editor.focus();
                document.execCommand('insertHTML', false,
                    `<img src="${dataUrl}" alt="Pasted image" loading="lazy"><br>`);
                this.debouncedSave();
                this.showToast('Image inserted', '🖼️');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ─── Block Management ──────────────────────────────────
    deleteBlock(block) {
        if (!block) return;
        // Insert a paragraph after the block so cursor has somewhere to go
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.parentNode.insertBefore(p, block);
        block.remove();
        // Set cursor into the paragraph
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.debouncedSave();
        this.showToast('Block deleted', '🗑️');
    }

    onCodeLangChange(selectEl) {
        this.debouncedSave();
    }

    // ─── Code Block Helpers ────────────────────────────────
    copyCodeBlock(btn) {
        const wrap = btn.closest('.code-block-wrap');
        const textarea = wrap?.querySelector('.code-textarea');
        if (textarea) {
            navigator.clipboard.writeText(textarea.value).then(() => this.showToast('Copied!', '✓'));
        }
    }

    setupCodeTextarea(textarea) {
        if (textarea._setupDone) return;
        textarea._setupDone = true;
        // Auto-resize
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        // Input handler for auto-resize and save
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            this.debouncedSave();
        });
        // Tab key inserts spaces
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                textarea.dispatchEvent(new Event('input'));
            }
        });
    }

    setupAllCodeTextareas() {
        this.editor.querySelectorAll('.code-block-wrap .code-textarea').forEach(ta => {
            this.setupCodeTextarea(ta);
        });
    }

    migrateCodeBlocks() {
        // Migrate old pre/code blocks to textarea-based blocks
        this.editor.querySelectorAll('.code-block-wrap').forEach(wrap => {
            if (wrap.querySelector('.code-textarea')) return; // Already migrated

            const codeEl = wrap.querySelector('pre code');
            const rawText = codeEl ? codeEl.textContent : '';
            const langClass = codeEl?.className?.match(/language-(\w+)/);
            const lang = langClass ? langClass[1] : 'plaintext';

            // Update header: fix copy button
            const copyBtn = wrap.querySelector('.copy-code-btn');
            if (copyBtn) {
                copyBtn.setAttribute('onclick', 'app.copyCodeBlock(this)');
            }

            // Ensure delete button exists
            const header = wrap.querySelector('.code-block-header');
            if (header && !header.querySelector('.delete-block-btn')) {
                let actionsDiv = header.querySelector('.code-block-actions');
                if (!actionsDiv) {
                    actionsDiv = document.createElement('div');
                    actionsDiv.className = 'code-block-actions';
                    const existingCopyBtn = header.querySelector('.copy-code-btn');
                    if (existingCopyBtn) actionsDiv.appendChild(existingCopyBtn);
                    header.appendChild(actionsDiv);
                }
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-block-btn';
                delBtn.textContent = '✕';
                delBtn.title = 'Delete code block';
                delBtn.addEventListener('click', () => this.deleteBlock(wrap));
                actionsDiv.appendChild(delBtn);
            }

            // Update select handler and set selected language
            const sel = header?.querySelector('select');
            if (sel) {
                sel.onchange = () => this.onCodeLangChange(sel);
                for (const opt of sel.options) {
                    if (opt.value === lang) { opt.selected = true; break; }
                }
            }

            // Replace pre/code with textarea
            const pre = wrap.querySelector('pre');
            if (pre) {
                const textarea = document.createElement('textarea');
                textarea.className = 'code-textarea';
                textarea.spellcheck = false;
                textarea.placeholder = 'Type or paste code here...';
                textarea.value = rawText;
                textarea.textContent = rawText;
                pre.replaceWith(textarea);
                this.setupCodeTextarea(textarea);
            }
        });
    }

    ensureBlockquoteDeleteButtons() {
        this.editor.querySelectorAll('blockquote').forEach(bq => {
            if (!bq.querySelector('.blockquote-delete-btn')) {
                const btn = document.createElement('button');
                btn.className = 'blockquote-delete-btn';
                btn.contentEditable = 'false';
                btn.title = 'Delete blockquote';
                btn.textContent = '✕';
                bq.appendChild(btn);
            }
        });
    }

    // ─── Helper Methods ────────────────────────────────────
    getParentElement(selector) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        return node?.closest(selector);
    }

    getCurrentBlock() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        while (node && node !== this.editor && node.parentElement !== this.editor) {
            node = node.parentElement;
        }
        return node === this.editor ? null : node;
    }

    // ─── Status Updates ────────────────────────────────────
    updateStatus() {
        const text = this.editor.textContent || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        this.statusWords.textContent = `${words} word${words !== 1 ? 's' : ''}`;
        this.statusChars.textContent = `${chars} char${chars !== 1 ? 's' : ''}`;

        if (this.activeNoteId && this.notes[this.activeNoteId]) {
            this.statusDate.textContent = formatFullDate(this.notes[this.activeNoteId].updatedAt);
        }
    }

    updateStorageMeter() {
        const info = this.storage.getStorageInfo();
        this.storageFill.style.width = info.percent + '%';
        this.storageText.textContent = formatBytes(info.used) + ' used';

        this.storageFill.classList.remove('warning', 'danger');
        if (info.percent > 80) this.storageFill.classList.add('danger');
        else if (info.percent > 60) this.storageFill.classList.add('warning');
    }

    // ─── View Controls ─────────────────────────────────────
    toggleSidebar() {
        this.sidebar.classList.toggle('collapsed');
        this.settings.sidebarCollapsed = this.sidebar.classList.contains('collapsed');
        this.storage.saveSettings(this.settings);
    }

    toggleTheme() {
        this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        this.updateHljsTheme();
        this.storage.saveSettings(this.settings);
        this.showToast(`${this.settings.theme === 'dark' ? 'Dark' : 'Light'} mode`, '🌓');
    }

    toggleZenMode() {
        this.isZen = !this.isZen;
        this.appLayout.classList.toggle('zen', this.isZen);
        this.showToast(this.isZen ? 'Zen mode on' : 'Zen mode off', '🧘');
    }

    // ─── Command Palette ───────────────────────────────────
    openCommandPalette() {
        this.closeAllModals();
        this.commandPalette.classList.add('open');
        this.commandInput.value = '';
        this.commandInput.focus();
        this.selectedCommandIndex = 0;
        this.filterCommands();
    }

    filterCommands() {
        const query = this.commandInput.value.toLowerCase().trim();
        this.filteredCommands = query
            ? this.commands.filter(c => c.label.toLowerCase().includes(query) || c.category.toLowerCase().includes(query))
            : this.commands;

        this.selectedCommandIndex = 0;
        this.renderCommands();
    }

    renderCommands() {
        let html = '';
        let lastCategory = '';
        this.filteredCommands.forEach((cmd, i) => {
            if (cmd.category !== lastCategory) {
                lastCategory = cmd.category;
                html += `<div class="command-category">${escapeHtml(cmd.category)}</div>`;
            }
            html += `<div class="command-item ${i === this.selectedCommandIndex ? 'selected' : ''}" data-index="${i}">
                <div class="command-item-left">
                    <span class="command-item-icon">${cmd.icon}</span>
                    <span class="command-item-label">${escapeHtml(cmd.label)}</span>
                </div>
                ${cmd.shortcut ? `<span class="command-item-shortcut">${cmd.shortcut}</span>` : ''}
            </div>`;
        });

        if (this.filteredCommands.length === 0) {
            html = '<div class="search-no-results">No commands found</div>';
        }

        this.commandList.innerHTML = html;

        // Bind click events
        this.commandList.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this.executeCommand(idx);
            });
        });
    }

    onCommandKeydown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedCommandIndex = Math.min(this.selectedCommandIndex + 1, this.filteredCommands.length - 1);
            this.renderCommands();
            this.scrollCommandIntoView();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedCommandIndex = Math.max(this.selectedCommandIndex - 1, 0);
            this.renderCommands();
            this.scrollCommandIntoView();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommand(this.selectedCommandIndex);
        } else if (e.key === 'Escape') {
            this.closeAllModals();
        }
    }

    scrollCommandIntoView() {
        const selected = this.commandList.querySelector('.command-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }

    executeCommand(index) {
        if (index < 0 || index >= this.filteredCommands.length) return;
        this.closeAllModals();
        this.filteredCommands[index].action();
    }

    // ─── Search Modal ──────────────────────────────────────
    openSearchModal() {
        this.closeAllModals();
        this.searchModal.classList.add('open');
        this.searchInput.value = '';
        this.searchInput.focus();
        this.searchResults.innerHTML = '<div class="search-no-results">Type to search across all notes...</div>';
    }

    performSearch() {
        const query = this.searchInput.value.toLowerCase().trim();
        if (!query) {
            this.searchResults.innerHTML = '<div class="search-no-results">Type to search across all notes...</div>';
            return;
        }

        const results = [];
        Object.values(this.notes).forEach(note => {
            const titleMatch = note.title.toLowerCase().includes(query);
            const text = stripHtml(note.content);
            const contentMatch = text.toLowerCase().includes(query);
            const tagMatch = note.tags.some(t => t.toLowerCase().includes(query));

            if (titleMatch || contentMatch || tagMatch) {
                let preview = '';
                if (contentMatch) {
                    const idx = text.toLowerCase().indexOf(query);
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(text.length, idx + query.length + 60);
                    preview = (start > 0 ? '...' : '') +
                        text.substring(start, idx) +
                        `<mark>${escapeHtml(text.substring(idx, idx + query.length))}</mark>` +
                        text.substring(idx + query.length, end) +
                        (end < text.length ? '...' : '');
                } else {
                    preview = text.substring(0, 100);
                }

                results.push({ note, preview, titleMatch });
            }
        });

        if (results.length === 0) {
            this.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            return;
        }

        this.searchResults.innerHTML = results.map(r => `
            <div class="search-result-item" data-id="${r.note.id}">
                <div class="search-result-title">${r.note.pinned ? '📌 ' : ''}${escapeHtml(r.note.title)}</div>
                <div class="search-result-preview">${r.preview}</div>
            </div>
        `).join('');

        this.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.closeAllModals();
                this.loadNote(item.dataset.id);
            });
        });
    }

    // ─── Import ─────────────────────────────────────────────
    triggerImport() {
        this.closeAllModals();
        document.getElementById('importFileInput').click();
    }

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const md = ev.target.result;
            const { title, html } = this.markdownToHtml(md);
            const name = title || file.name.replace(/\.(md|markdown|txt)$/i, '');
            this.createNote(name, html);
            this.showToast('Note imported', '📥');
        };
        reader.readAsText(file);
        // Reset so same file can be imported again
        e.target.value = '';
    }

    markdownToHtml(md) {
        let title = '';
        const lines = md.split('\n');
        let html = '';
        let i = 0;

        // Extract title from first H1
        if (lines[0] && /^#\s+/.test(lines[0])) {
            title = lines[0].replace(/^#\s+/, '').trim();
            i = 1;
            // Skip blank line after title
            if (i < lines.length && lines[i].trim() === '') i++;
        }

        // Process lines
        while (i < lines.length) {
            const line = lines[i];

            // Fenced code block
            const codeMatch = line.match(/^```(\w*)$/);
            if (codeMatch) {
                const lang = codeMatch[1] || 'plaintext';
                const codeLines = [];
                i++;
                while (i < lines.length && !lines[i].match(/^```\s*$/)) {
                    codeLines.push(lines[i]);
                    i++;
                }
                i++; // skip closing ```
                const languages = ['plaintext', 'javascript', 'typescript', 'python', 'csharp', 'java',
                    'html', 'css', 'json', 'sql', 'bash', 'powershell', 'go', 'rust', 'cpp', 'ruby', 'php', 'yaml', 'xml', 'markdown'];
                const options = languages.map(l => `<option value="${l}"${l === lang ? ' selected' : ''}>${l}</option>`).join('');
                const code = escapeHtml(codeLines.join('\n'));
                html += `<div class="code-block-wrap" contenteditable="false"><div class="code-block-header"><select onchange="app.onCodeLangChange(this)">${options}</select><div class="code-block-actions"><button class="copy-code-btn" onclick="app.copyCodeBlock(this)">Copy</button><button class="delete-block-btn" onclick="app.deleteBlock(this.closest('.code-block-wrap'))" title="Delete code block">✕</button></div></div><textarea class="code-textarea" spellcheck="false" placeholder="Type or paste code here...">${code}</textarea></div>`;
                continue;
            }

            // Headings
            if (/^###\s+/.test(line)) { html += `<h3>${this.inlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`; i++; continue; }
            if (/^##\s+/.test(line)) { html += `<h2>${this.inlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`; i++; continue; }
            if (/^#\s+/.test(line)) { html += `<h1>${this.inlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`; i++; continue; }

            // Horizontal rule
            if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html += '<hr>'; i++; continue; }

            // Blockquote
            if (/^>\s?/.test(line)) {
                const bqLines = [];
                while (i < lines.length && /^>\s?/.test(lines[i])) {
                    bqLines.push(lines[i].replace(/^>\s?/, ''));
                    i++;
                }
                html += `<blockquote><p>${this.inlineMarkdown(bqLines.join(' '))}</p></blockquote>`;
                continue;
            }

            // Todo items: - [x] or - [ ]
            if (/^[-*]\s+\[([ xX])\]\s+/.test(line)) {
                const checked = /\[[xX]\]/.test(line);
                const text = line.replace(/^[-*]\s+\[[ xX]\]\s+/, '');
                html += `<div class="todo-item${checked ? ' checked' : ''}"><span class="todo-checkbox" contenteditable="false"></span><span class="todo-text">${this.inlineMarkdown(text)}</span></div>`;
                i++;
                continue;
            }

            // Unordered list
            if (/^[-*+]\s+/.test(line)) {
                html += '<ul>';
                while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
                    html += `<li>${this.inlineMarkdown(lines[i].replace(/^[-*+]\s+/, ''))}</li>`;
                    i++;
                }
                html += '</ul>';
                continue;
            }

            // Ordered list
            if (/^\d+\.\s+/.test(line)) {
                html += '<ol>';
                while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                    html += `<li>${this.inlineMarkdown(lines[i].replace(/^\d+\.\s+/, ''))}</li>`;
                    i++;
                }
                html += '</ol>';
                continue;
            }

            // Blank line
            if (line.trim() === '') { i++; continue; }

            // Paragraph
            html += `<p>${this.inlineMarkdown(line)}</p>`;
            i++;
        }

        return { title, html: html || '<p></p>' };
    }

    inlineMarkdown(text) {
        return text
            // Images: ![alt](src)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
            // Links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            // Bold + italic
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Strikethrough
            .replace(/~~(.+?)~~/g, '<s>$1</s>')
            // Highlight ==text==
            .replace(/==(.+?)==/g, '<mark>$1</mark>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    // ─── Export ─────────────────────────────────────────────
    exportNote(format) {
        if (!this.activeNoteId || !this.notes[this.activeNoteId]) return;
        const note = this.notes[this.activeNoteId];
        let content, filename, mime;

        switch (format) {
            case 'html':
                content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(note.title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1d2e;}code{background:#f0f1f5;padding:2px 6px;border-radius:4px;font-family:'Cascadia Code',monospace;}pre{background:#f5f6fa;padding:16px;border-radius:8px;overflow-x:auto;}blockquote{border-left:3px solid #4a7de0;padding:10px 16px;margin:10px 0;background:rgba(74,125,224,0.05);}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px 12px;}th{background:#f0f1f5;}img{max-width:100%;}</style></head><body><h1>${escapeHtml(note.title)}</h1>${note.content}</body></html>`;
                filename = `${note.title}.html`;
                mime = 'text/html';
                break;
            case 'markdown':
                content = this.htmlToMarkdown(note.content, note.title);
                filename = `${note.title}.md`;
                mime = 'text/markdown';
                break;
            case 'text':
                content = `${note.title}\n${'='.repeat(note.title.length)}\n\n${stripHtml(note.content)}`;
                filename = `${note.title}.txt`;
                mime = 'text/plain';
                break;
        }

        // Download
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/[<>:"/\\|?*]/g, '_');
        a.click();
        URL.revokeObjectURL(url);
        this.showToast(`Exported as ${format.toUpperCase()}`, '📤');
    }

    htmlToMarkdown(html, title = '') {
        const div = document.createElement('div');
        div.innerHTML = html;
        let md = title ? `# ${title}\n\n` : '';

        const convert = (node) => {
            let text = '';
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    text += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName.toLowerCase();
                    switch (tag) {
                        case 'h1': text += `# ${convert(child)}\n\n`; break;
                        case 'h2': text += `## ${convert(child)}\n\n`; break;
                        case 'h3': text += `### ${convert(child)}\n\n`; break;
                        case 'p': text += `${convert(child)}\n\n`; break;
                        case 'strong': case 'b': text += `**${convert(child)}**`; break;
                        case 'em': case 'i': text += `*${convert(child)}*`; break;
                        case 'u': text += `<u>${convert(child)}</u>`; break;
                        case 's': case 'strike': case 'del': text += `~~${convert(child)}~~`; break;
                        case 'code':
                            if (child.closest('pre')) text += child.textContent;
                            else text += `\`${child.textContent}\``;
                            break;
                        case 'pre': text += `\`\`\`\n${child.textContent}\n\`\`\`\n\n`; break;
                        case 'br': text += '\n'; break;
                        case 'hr': text += '\n---\n\n'; break;
                        case 'a': text += `[${convert(child)}](${child.getAttribute('href') || ''})`; break;
                        case 'img': text += `![${child.getAttribute('alt') || 'image'}](${child.getAttribute('src') || ''})`; break;
                        case 'ul': child.querySelectorAll(':scope > li').forEach(li => { text += `- ${convert(li)}\n`; }); text += '\n'; break;
                        case 'ol': { let idx = 1; child.querySelectorAll(':scope > li').forEach(li => { text += `${idx++}. ${convert(li)}\n`; }); text += '\n'; break; }
                        case 'li': text += convert(child); break;
                        case 'blockquote': text += convert(child).split('\n').map(l => `> ${l}`).join('\n') + '\n\n'; break;
                        case 'mark': text += `==${convert(child)}==`; break;
                        case 'div':
                            if (child.classList.contains('todo-item')) {
                                const checked = child.classList.contains('checked');
                                const todoText = child.querySelector('.todo-text')?.textContent || '';
                                text += `- [${checked ? 'x' : ' '}] ${todoText}\n`;
                            } else if (child.classList.contains('code-block-wrap')) {
                                const textarea = child.querySelector('.code-textarea');
                                const select = child.querySelector('select');
                                const lang = select?.value || 'plaintext';
                                const code = textarea?.value || textarea?.textContent || child.querySelector('code')?.textContent || '';
                                text += `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
                            } else {
                                text += convert(child);
                            }
                            break;
                        default: text += convert(child); break;
                    }
                }
            });
            return text;
        };

        md += convert(div);
        return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    // ─── Modals ────────────────────────────────────────────
    openModal(modal) {
        this.closeAllModals();
        modal.classList.add('open');
    }

    closeAllModals() {
        [this.commandPalette, this.searchModal, this.shortcutsModal, this.exportModal, this.templateModal].forEach(m => {
            m.classList.remove('open');
        });
    }

    // ─── Toast Notifications ───────────────────────────────
    showToast(message, icon = 'ℹ️') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 200);
        }, 2500);
    }
}

// ─── Initialize App ────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
