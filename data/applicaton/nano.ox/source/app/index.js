// Nano Editor App Logic
// This file runs inside the nano.ox app window (iframe)

// --- File API communication ---
// The terminal will launch nano with a file path (and optionally file content)
// Communication is via localStorage (set by terminal)

function getNanoFileLocalStorage() {
  return {
    file: localStorage.getItem('nano_file_path') || '',
    content: localStorage.getItem('nano_file_content') || ''
  };
}

const nanoFile = getNanoFileLocalStorage();
const filePath = nanoFile.file || '';

const editor = document.getElementById('nano-editor');
const status = document.getElementById('nano-status');
const filenameSpan = document.getElementById('nano-filename');

filenameSpan.textContent = filePath ? ' ' + filePath : ' [New File]';
editor.value = nanoFile.content || '';
status.textContent = `[ ${filePath || 'New File'} ]`;

// Block only dangerous browser/Chrome shortcuts when editor is focused
editor.addEventListener('keydown', (e) => {
  // Allow Nano's own shortcuts: Ctrl+S, Ctrl+O, Ctrl+X
  const allowedNanoShortcuts = [
    (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's'),
    (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'o'),
    (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'x')
  ];
  if (allowedNanoShortcuts.some(Boolean)) {
    // Let Nano handle these below
  } else {
    // Block only dangerous browser shortcuts (close, reload, devtools, new tab, etc.)
    const blockedKeys = [
      'w','r','t','n','F4','F5','F12','l','u','d','q','h','j','k','b','e','y','z','x','c','v','a'
    ];
    if ((e.ctrlKey || e.metaKey) && blockedKeys.includes(e.key.length === 1 ? e.key.toLowerCase() : e.key)) {
      e.preventDefault();
      status.textContent = '[ Shortcut blocked by OliveOS nano ]';
      setTimeout(() => status.textContent = `[ ${filePath || 'New File'} ]`, 1200);
      return;
    }
  }
  // Save: Ctrl+S
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    localStorage.setItem('nano_file_path', filePath);
    localStorage.setItem('nano_file_content', editor.value);
    status.textContent = '[ Saved ' + (filePath || 'New File') + ' ]';
    setTimeout(() => status.textContent = `[ ${filePath || 'New File'} ]`, 1200);
    return;
  }
  // WriteOut: Ctrl+O
  if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault();
    localStorage.setItem('nano_file_path', filePath);
    localStorage.setItem('nano_file_content', editor.value);
    status.textContent = '[ Wrote ' + (filePath || 'New File') + ' ]';
    setTimeout(() => status.textContent = `[ ${filePath || 'New File'} ]`, 1200);
    return;
  }
  // Exit: Ctrl+X
  if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
    e.preventDefault();
    localStorage.setItem('nano_file_path', filePath);
    localStorage.setItem('nano_file_content', editor.value);
    window.close();
    return;
  }
});

// Focus editor on load
window.onload = () => editor.focus();
