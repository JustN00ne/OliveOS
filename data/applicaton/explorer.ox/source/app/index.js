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

// File Explorer logic for OliveOS
// Uses OliveFS for all file operations

let currentPath = '/cloud'; // Default to the cloud directory for easier testing
let selected = null;

// The `update` function is now async to handle file operations
async function update() {
    document.getElementById('current-path').textContent = currentPath;
    // Clear the file content pane unless a file is selected
    if (!selected || selected.type === 'dir') {
        document.getElementById('file-content').textContent = '';
    }
    // Await the rendering of the directory
    await renderDir(currentPath);
}

// `renderDir` must be async because it calls the async `listDir`
async function renderDir(path) {
    const dirList = document.getElementById('dir-list');
    dirList.innerHTML = 'Loading...'; // Provide immediate feedback
    let items;
    try {
        // CORRECT: Use `await` to get the array from the Promise
        items = await window.OliveFS.listDir(path);
    } catch (e) {
        console.error("Error listing directory:", e);
        dirList.innerHTML = `<div style='color:#f55'>Error: ${e.message}</div>`;
        return;
    }

    // Defensive check
    if (!Array.isArray(items)) {
        console.error("OliveFS.listDir did not return an array. Got:", items);
        dirList.innerHTML = `<div style='color:#f55'>Error: Filesystem returned invalid data.</div>`;
        return;
    }

    dirList.innerHTML = ''; // Clear "Loading..." message

    // Add "Up" directory button if not at root
    if (path !== '/') {
        const up = document.createElement('div');
        up.className = 'folder';
        up.innerHTML = `<span class='icon'>⬆️</span>..`;
        up.onclick = goUp; // goUp is async
        dirList.appendChild(up);
    }

    // Sort folders before files, then alphabetically
    items.sort((a, b) => (a.type === 'dir' ? -1 : 1) - (b.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name));

    for (const item of items) {
        const el = document.createElement('div');
        el.className = item.type === 'dir' ? 'folder' : 'file';
        el.innerHTML = `<span class='icon'>${item.type === 'dir' ? '📁' : '📄'}</span>${item.name}`;
        // Pass both the element and the item data
        el.onclick = () => selectItem(el, item);
        dirList.appendChild(el);
    }
}

// `goUp` is async because it calls the async `update`
async function goUp() {
    if (currentPath === '/') return;
    currentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    selected = null;
    await update();
}

// `selectItem` is async because it calls `update` and `showFile`
async function selectItem(element, item) {
    // Update visual selection immediately
    document.querySelectorAll('#dir-list .selected').forEach(el => el.classList.remove('selected'));
    if (element) {
      element.classList.add('selected');
    }

    selected = item;
    if (item.type === 'dir') {
        currentPath = (currentPath === '/' ? '' : currentPath) + '/' + item.name;
        selected = null;
        await update();
    } else {
        await showFile(item);
    }
}

// `showFile` is async because it calls the async `readFile`
async function showFile(item) {
    const contentPane = document.getElementById('file-content');
    contentPane.textContent = 'Loading file...';
    try {
        const fullPath = (currentPath === '/' ? '' : currentPath) + '/' + item.name;
        // CORRECT: Use `await` to get file content
        const content = await window.OliveFS.readFile(fullPath);
        contentPane.textContent = content;
    } catch (e) {
        console.error("Error reading file:", e);
        contentPane.textContent = `Error: ${e.message}`;
    }
}

// --- Event Handlers ---

document.getElementById('btn-up').onclick = goUp;

document.getElementById('btn-new-folder').onclick = async () => {
    const name = prompt('New folder name:');
    if (!name || !name.trim()) return;
    try {
        await window.OliveFS.mkdir((currentPath === '/' ? '' : currentPath) + '/' + name.trim());
        await update(); // Await the update to see the new folder
    } catch (e) {
        alert(e.message);
    }
};

document.getElementById('btn-new-file').onclick = async () => {
    const name = prompt('New file name:');
    if (!name || !name.trim()) return;
    try {
        await window.OliveFS.writeFile((currentPath === '/' ? '' : currentPath) + '/' + name.trim(), 'New file content.');
        await update(); // Await the update to see the new file
    } catch (e) {
        alert(e.message);
    }
};

document.getElementById('btn-delete').onclick = async () => {
    if (!selected) {
        return alert('Select a file or folder to delete.');
    }
    if (!confirm(`Are you sure you want to delete "${selected.name}"?`)) {
        return;
    }
    try {
        await window.OliveFS.deleteFile((currentPath === '/' ? '' : currentPath) + '/' + selected.name);
        selected = null; // Deselect after deletion
        await update(); // Await the update to refresh the view
    } catch (e) {
        alert(e.message);
    }
};

// Initial load
update();
