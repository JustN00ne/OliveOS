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