// --- Global Logging Utility ---
window.LogStore = [];
window.LogType = {
  0: "INFO",
  1: "WARN",
  2: "ERRR",
  3: "CRIT",
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};
window.Log = function Log(source, message, type = 0) {
  if (typeof type === 'string' && window.LogType[type] !== undefined) type = window.LogType[type];
  if (!window.LogType[type]) return;
  const timestamp = new Date().toJSON();
  const msg = `[${window.LogType[type]}] ${source}: ${message}`;
  console.log(msg);
  window.LogStore.push(msg);
};

document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('notepad-textarea');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const status = document.getElementById('notepad-status');

    // Load saved note from localStorage
    textarea.value = localStorage.getItem('notepad-content') || '';

    saveBtn.onclick = function() {
        localStorage.setItem('notepad-content', textarea.value);
        status.textContent = 'Note saved!';
        setTimeout(() => status.textContent = '', 1200);
    };

    clearBtn.onclick = function() {
        textarea.value = '';
        localStorage.removeItem('notepad-content');
        status.textContent = 'Cleared!';
        setTimeout(() => status.textContent = '', 1200);
    };
});