// --- OliveFS: LocalStorage-based Virtual Filesystem ---
// Usage: window.OliveFS.readFile('/foo/bar.txt'), etc.
window.OliveFS = (function() {
    const FS_KEY = 'oliveos_fs_v2';
    // Internal: get full FS tree
    function getFS() {
        const raw = localStorage.getItem(FS_KEY);
        if (!raw) return { '/': { type: 'dir', children: {} } };
        try { return JSON.parse(raw); } catch { return { '/': { type: 'dir', children: {} } }; }
    }
    // Internal: save FS tree
    function saveFS(fs) {
        localStorage.setItem(FS_KEY, JSON.stringify(fs));
    }
    // Normalize path (always starts with /, no trailing / except root)
    function norm(p) {
        if (!p.startsWith('/')) p = '/' + p;
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
        return p;
    }
    // Split path into parts
    function parts(p) {
        return norm(p).split('/').filter(Boolean);
    }
    // Traverse to parent dir, return [parentObj, name]
    function traverse(fs, p) {
        const ps = parts(p);
        let cur = fs['/'];
        for (let i = 0; i < ps.length - 1; ++i) {
            if (!cur.children[ps[i]] || cur.children[ps[i]].type !== 'dir') return [null, null];
            cur = cur.children[ps[i]];
        }
        return [cur, ps[ps.length - 1]];
    }
    // API
    return {
        exists(path) {
            path = norm(path);
            const fs = getFS();
            if (path === '/') return true;
            const [par, name] = traverse(fs, path);
            return !!(par && par.children[name]);
        },
        isDir(path) {
            path = norm(path);
            const fs = getFS();
            if (path === '/') return true;
            const [par, name] = traverse(fs, path);
            return !!(par && par.children[name] && par.children[name].type === 'dir');
        },
        mkdir(path) {
            path = norm(path);
            if (path === '/') return;
            const fs = getFS();
            const [par, name] = traverse(fs, path);
            if (!par) throw new Error('Parent dir does not exist');
            if (par.children[name]) throw new Error('File or dir exists');
            par.children[name] = { type: 'dir', children: {}, created: Date.now(), modified: Date.now() };
            saveFS(fs);
        },
        writeFile(path, data) {
            path = norm(path);
            if (path === '/') throw new Error('Cannot write to root');
            const fs = getFS();
            const [par, name] = traverse(fs, path);
            if (!par) throw new Error('Parent dir does not exist');
            par.children[name] = {
                type: 'file',
                data: typeof data === 'string' ? data : JSON.stringify(data),
                created: par.children[name]?.created || Date.now(),
                modified: Date.now(),
                size: (typeof data === 'string' ? data.length : JSON.stringify(data).length)
            };
            saveFS(fs);
        },
        readFile(path) {
            path = norm(path);
            if (path === '/') throw new Error('Cannot read root');
            const fs = getFS();
            const [par, name] = traverse(fs, path);
            if (!par || !par.children[name] || par.children[name].type !== 'file') throw new Error('File not found');
            return par.children[name].data;
        },
        deleteFile(path) {
            path = norm(path);
            if (path === '/') throw new Error('Cannot delete root');
            const fs = getFS();
            const [par, name] = traverse(fs, path);
            if (!par || !par.children[name]) throw new Error('Not found');
            delete par.children[name];
            saveFS(fs);
        },
        listDir(path) {
            path = norm(path);
            const fs = getFS();
            let cur = fs['/'];
            if (path !== '/') {
                const [par, name] = traverse(fs, path);
                if (!par || !par.children[name] || par.children[name].type !== 'dir') throw new Error('Dir not found');
                cur = par.children[name];
            }
            return Object.entries(cur.children).map(([name, obj]) => ({
                name,
                type: obj.type,
                size: obj.size || 0,
                created: obj.created,
                modified: obj.modified
            }));
        },
        stat(path) {
            path = norm(path);
            const fs = getFS();
            if (path === '/') return { type: 'dir', name: '/', created: 0, modified: 0 };
            const [par, name] = traverse(fs, path);
            if (!par || !par.children[name]) throw new Error('Not found');
            const obj = par.children[name];
            return { type: obj.type, name, size: obj.size || 0, created: obj.created, modified: obj.modified };
        },
        // For debugging: reset FS
        _reset() { localStorage.removeItem(FS_KEY); }
    };
})();

lucide.createIcons(); // Initialize Feather icons globally

// Pill animation logic
function animatePills() {
    document.querySelectorAll('.pill_top_notfbar .hidden-anim').forEach((pill, i) => {
        setTimeout(() => {
            pill.classList.remove('hidden-anim');
            pill.classList.add('show-anim');
        }, 300 * i);
    });
}

// Tooltip logic for elements with data-tooltip
function setupTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', function (e) {
            let tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = el.getAttribute('data-tooltip');
            tooltip.style.position = 'absolute';
            tooltip.style.opacity = '0';
            document.body.appendChild(tooltip);
            // Wait for DOM to render to get correct size
            requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                // Center horizontally above the element
                tooltip.style.left = (rect.left + window.scrollX + rect.width / 2 - tooltipRect.width / 2) + 'px';
                // Place directly above the element
                tooltip.style.top = (rect.top + window.scrollY - tooltipRect.height - 0) + 'px';
                tooltip.style.opacity = '1';
            });
            el._tooltip = tooltip;
        });
        el.addEventListener('mouseleave', function (e) {
            if (el._tooltip) {
                el._tooltip.remove();
                el._tooltip = null;
            }
        });
    });
}

// Remove all pointer events for the pill_top_notfbar class
const pillBar = document.querySelector('.pill_top_notfbar');
if (pillBar) pillBar.style.pointerEvents = 'none';

// --- App System ---
const appTemplates = [
    {
        id: 'olive.settings.ox',
        name: 'Settings',
        icon: 'settings',
        iframe: 'https://example.com', // Replace with your app URL or leave blank
    },
    // Add more app templates here if needed
];

let openApps = [];
let focusedAppIndex = 0;

function createAppWindow(app) {
    const win = document.createElement('div');
    win.className = 'app_window hidden';
    win.id = app.id;
    // Set user-select to none when dragging or minimized
    function setUserSelectNone(val) {
        win.style.userSelect = val ? 'none' : '';
        win.style.webkitUserSelect = val ? 'none' : '';
        win.style.MozUserSelect = val ? 'none' : '';
        win.style.msUserSelect = val ? 'none' : '';
    }
    // Icon fallback logic: try main, fallback if error
    let iconHtml = '';
    if (app.icon && app.icon.endsWith('.png')) {
        iconHtml = `<img src="${app.icon}" alt="${app.name}" onerror="this.onerror=null;this.src='${app.iconFallback}'" class="fade-icon" />`;
    } else {
        iconHtml = `<i class="lucide" data-lucide="${app.icon}"></i>`;
    }
    win.innerHTML = `
        <div class="head_m drag_handle">
            <div class="buttons_control">
                <button class="close_b_a_m fade-hover"><i class="lucide" data-lucide="x"></i></button>
                <button class="min_b_a_m fade-hover"><i class="lucide" data-lucide="minimize-2"></i></button>
                <button class="windowcontrol_b_a_m fade-hover" disabled><i class="lucide" data-lucide="maximize-2"></i></button>
            </div>
            <div class="app_divider"></div>
            <div class="app_icon">${iconHtml}</div>
            <span class="app_name">${app.name}</span>
            <span class="dynamic_title"></span>
        </div>
        <div class="app_content">
            <iframe src="${app.iframe}" class="app_iframe" frameborder="0" allowfullscreen></iframe>
        </div>
    `;
    // Make resizable
    win.style.resize = 'both';
    win.style.overflow = 'auto';
    win.style.minWidth = '320px';
    win.style.minHeight = '200px';
    win.style.position = 'absolute';
    win.style.left = '300px';
    win.style.top = '200px';
    win.style.width = '700px';
    win.style.height = '400px';
    // --- Disable iframe pointer events while resizing ---
    let resizing = false;
    let resizeObserver = new ResizeObserver(() => {
        if (!resizing) return;
        const iframe = win.querySelector('iframe');
        if (iframe) iframe.style.pointerEvents = 'none';
        // Remove all transitions/animations while resizing
        win.style.transition = 'none';
        win.style.animation = 'none';
        if (iframe) iframe.style.transition = 'none';
        if (iframe) iframe.style.animation = 'none';
    });
    win.addEventListener('mousedown', function(e) {
        if (e.target === win && win.style.resize !== 'none') {
            resizing = true;
            const iframe = win.querySelector('iframe');
            if (iframe) iframe.style.pointerEvents = 'none';
            // Remove all transitions/animations at start of resize
            win.style.transition = 'none';
            win.style.animation = 'none';
            if (iframe) iframe.style.transition = 'none';
            if (iframe) iframe.style.animation = 'none';
        }
    });
    win.addEventListener('mouseup', function() {
        if (resizing) {
            resizing = false;
            const iframe = win.querySelector('iframe');
            if (iframe) iframe.style.pointerEvents = '';
            // Restore transitions/animations after resize
            win.style.transition = '';
            win.style.animation = '';
            if (iframe) iframe.style.transition = '';
            if (iframe) iframe.style.animation = '';
        }
    });
    resizeObserver.observe(win);
    // Animate in
    setTimeout(() => {
        win.classList.add('anim-opening');
        win.classList.remove('hidden');
        setTimeout(() => win.classList.remove('anim-opening'), 250);
    }, 10);
    // Button events
    win.querySelector('.close_b_a_m').onclick = () => {
        win.classList.add('anim-closing');
        setTimeout(() => closeApp(app.id), 220);
    };
    win.querySelector('.min_b_a_m').onclick = () => {
        setUserSelectNone(true);
        win.classList.add('anim-minimizing');
        // Disable pointer events on iframe during minimize
        const iframe = win.querySelector('iframe');
        if (iframe) iframe.style.pointerEvents = 'none';
        setTimeout(() => {
            win.classList.remove('anim-minimizing');
            minimizeApp(app.id);
            setUserSelectNone(false);
            // After fade out, hide window
            win.style.display = 'none';
            // Restore iframe pointer events for when unminimized
            if (iframe) iframe.style.pointerEvents = '';
        }, 220);
    };
    // Maximize button is disabled for now
    // Add drag events
    makeWindowDraggable(win, setUserSelectNone);
    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 0);
    return win;
}

function makeWindowDraggable(win, setUserSelectNone) {
    const dragHandle = win.querySelector('.drag_handle');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let animationFrame;
    let winRect, winWidth, winHeight;
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
    function onMouseDown(e) {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        winRect = win.getBoundingClientRect();
        startLeft = winRect.left;
        startTop = winRect.top;
        winWidth = winRect.width;
        winHeight = winRect.height;
        win.classList.add('dragging');
        if (setUserSelectNone) setUserSelectNone(true);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!isDragging) return;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;
            // Clamp to viewport
            let newLeft = clamp(startLeft + dx, 0, window.innerWidth - winWidth);
            let newTop = clamp(startTop + dy, 0, window.innerHeight - winHeight);
            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
        });
    }
    function onMouseUp() {
        isDragging = false;
        win.classList.remove('dragging');
        if (setUserSelectNone) setUserSelectNone(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    dragHandle.addEventListener('mousedown', onMouseDown);
    // Touch support
    dragHandle.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        winRect = win.getBoundingClientRect();
        startLeft = winRect.left;
        startTop = winRect.top;
        winWidth = winRect.width;
        winHeight = winRect.height;
        win.classList.add('dragging');
        if (setUserSelectNone) setUserSelectNone(true);
        document.addEventListener('touchmove', onTouchMove, {passive:false});
        document.addEventListener('touchend', onTouchEnd);
        e.preventDefault();
    });
    function onTouchMove(e) {
        if (!isDragging) return;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            let dx = e.touches[0].clientX - startX;
            let dy = e.touches[0].clientY - startY;
            let newLeft = clamp(startLeft + dx, 0, window.innerWidth - winWidth);
            let newTop = clamp(startTop + dy, 0, window.innerHeight - winHeight);
            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
        });
    }
    function onTouchEnd() {
        isDragging = false;
        win.classList.remove('dragging');
        if (setUserSelectNone) setUserSelectNone(false);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    }
}

// --- Fix window rescaling (remove scale/rounded effect on resize/minimize) ---
// Remove 'scale' property from .app_window.show-app and .app_window.minimized in taskbar.css

function createTaskbarIcon(app) {
    const icon = document.createElement('div');
    icon.className = 'taskbar-app-icon';
    icon.innerHTML = `<i data-lucide="${app.icon}"></i>`;
    icon.title = app.name;
    icon.onclick = () => focusApp(app.id);
    icon.onwheel = (e) => {
        if (openApps.length > 1) {
            focusedAppIndex = (focusedAppIndex + (e.deltaY > 0 ? 1 : -1) + openApps.length) % openApps.length;
            focusApp(openApps[focusedAppIndex].id);
        }
    };
    icon.onmouseenter = () => {
        if (openApps.length > 1) icon.classList.add('hovered');
    };
    icon.onmouseleave = () => icon.classList.remove('hovered');
    return icon;
}

function openApp(appId) {
    if (openApps.find(a => a.id === appId)) {
        focusApp(appId);
        return;
    }
    const app = appTemplates.find(a => a.id === appId);
    if (!app) return;
    const win = createAppWindow(app);
    document.getElementById('app_windows_container').appendChild(win);
    openApps.push(app);
    focusedAppIndex = openApps.length - 1;
    win.classList.remove('hidden');
    focusApp(appId);
    // Set document title to app name
    if (app.name) document.title = app.name;
}

function closeApp(appId) {
    const win = document.getElementById(appId);
    if (win) win.remove(); // Remove from DOM
    openApps = openApps.filter(a => a.id !== appId);
    // Optionally, focus another open app if any
    const stillOpen = Array.from(document.querySelectorAll('.app_window:not(.hidden)'));
    if (stillOpen.length) {
        focusApp(stillOpen[stillOpen.length - 1].id);
    }
}

function minimizeApp(appId) {
    const win = document.getElementById(appId);
    if (win) {
        win.classList.add('minimized');
        win.style.display = 'none';
    }
}

// --- Multiple window system: bring to front on focus/click ---
function focusApp(appId) {
    // Find the max zIndex among all app windows
    let maxZ = 10;
    document.querySelectorAll('.app_window').forEach(w => {
        let z = parseInt(w.style.zIndex) || 10;
        if (z > maxZ) maxZ = z;
    });
    // Set this window to maxZ+1
    const win = document.getElementById(appId);
    if (win) {
        win.classList.remove('minimized');
        win.style.display = '';
        win.style.zIndex = maxZ + 1;
        win.classList.add('focused');
        document.querySelectorAll('.app_window').forEach(w => {
            if (w.id !== appId) w.classList.remove('focused');
        });
    }
    // Highlight taskbar icon
    document.querySelectorAll('.taskbar-app-icon').forEach(i => i.classList.remove('active'));
    const icon = document.getElementById('taskbar_icon_' + appId);
    if (icon) icon.classList.add('active');
    // Update focusedAppIndex
    focusedAppIndex = openApps.findIndex(a => a.id === appId);
}

// Bring to front on click anywhere in window
function setupWindowFocusOnClick() {
    document.getElementById('app_windows_container').addEventListener('mousedown', e => {
        let win = e.target.closest('.app_window');
        if (win) focusApp(win.id);
    });
}

// Remove the setupAppLauncher function so the menu icon does nothing
// function setupAppLauncher() {
//     document.getElementById('app_launcher_btn').onclick = () => {
//         openApp('olive.settings.ox');
//     };
// }

// Add back the setupAppScaling function to avoid ReferenceError
function setupAppScaling() {
    // This function can be left empty or used for future responsive scaling logic
}

// --- Dynamic App Loader for OliveOS ---
// Scans data/applicaton/* for @manifest.oman and loads apps dynamically
async function loadDynamicApps() {
    // Helper to parse .oman files (very basic INI parser)
    function parseOman(text) {
        const result = {};
        let section = null;
        text.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) return;
            // Remove inline comments after #
            if (line.includes('#')) line = line.split('#')[0].trim();
            if (!line) return;
            if (line.startsWith('@#[')) {
                section = line.match(/@#\[(.+?)\]/)?.[1] || null;
                if (section) result[section] = {};
                return;
            }
            if (section && line.includes('=')) {
                let [k, v] = line.split('=').map(s => s.trim());
                // Remove quotes if present
                if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
                // Parse booleans for invisible
                if (k === 'invisible') {
                    v = (v === 'true' || v === '1');
                }
                result[section][k] = v;
            }
        });
        return result;
    }
    // Find all app folders
    const appRoot = 'data/applicaton';
    // Fetch all apps, including invisible, so they can be opened directly
    const res = await fetch('/list-apps?all=true'); // Custom endpoint to list app folders
    const appFolders = await res.json();
    for (const folder of appFolders) {
        try {
            const manifestRes = await fetch(`/${appRoot}/${folder}/@manifest.oman`);
            if (!manifestRes.ok) continue;
            const manifestText = await manifestRes.text();
            const manifest = parseOman(manifestText);
            // --- Use manifest for all app info ---
            // Get app id and display name
            const appId = manifest.app?.id || folder;
            const appName = manifest.app?.name || folder;
            // Icon path (relative to app folder)
            let appIcon = undefined;
            if (manifest.app?.icon) {
                // If icon starts with /, treat as relative to app folder
                appIcon = `/${appRoot}/${folder}${manifest.app.icon.startsWith('/') ? manifest.app.icon : '/' + manifest.app.icon}`;
            } else {
                // Fallback: try /source/assets/icon.png
                appIcon = `/${appRoot}/${folder}/source/assets/icon.png`;
            }
            // Working directory (where @app.oman is)
            let workingDir = manifest.runtime?.working_directory || '/source/app/';
            workingDir = workingDir.trim().replace(/\\/g, '/').replace(/\s+/g, '');
            if (workingDir.endsWith('/')) workingDir = workingDir.slice(0, -1);
            // Read @app.oman from working_directory
            let appOman = {};
            let htmlFile = 'index.html';
            try {
                const appOmanRes = await fetch(`/${appRoot}/${folder}${workingDir}/@app.oman`);
                if (appOmanRes.ok) {
                    const appOmanText = await appOmanRes.text();
                    appOman = parseOman(appOmanText);
                    // Find the first .html file in sources
                    if (appOman.sources) {
                        for (const key in appOman.sources) {
                            if (appOman.sources[key] && appOman.sources[key].endsWith('.html')) {
                                htmlFile = appOman.sources[key].replace(/^\//, '');
                                break;
                            }
                        }
                    }
                }
            } catch {}
            // Compose iframe path
            let iframePath = `/${appRoot}/${folder}${workingDir ? `/${workingDir}` : ''}/${htmlFile}`;
            iframePath = iframePath.replace(/\\/g, '/').replace(/\s+/g, '');
            iframePath = iframePath.replace(/([^:])\/+/g, '$1/');
            // UI config
            const ui = manifest.ui || {};
            let width = ui.width ? parseInt(ui.width) : 700;
            let height = ui.height ? parseInt(ui.height) : 400;
            let resizable = ui.resizable !== undefined ? (ui.resizable === 'true' || ui.resizable === true) : true;
            let fullscreen = ui.fullscreen !== undefined ? (ui.fullscreen === 'true' || ui.fullscreen === true) : false;
            let type = ui.type || 'windowed';
            let invisible = false;
            if (typeof ui.invisible !== 'undefined') {
                invisible = ui.invisible === true;
            }
            // Register app in appTemplates
            appTemplates.push({
                id: appId,
                name: appName,
                icon: appIcon,
                iframe: iframePath,
                width,
                height,
                resizable,
                fullscreen,
                type,
                invisible
            });
        } catch (e) { console.warn('Failed to load app', folder, e); }
    }
}

// --- Render dynamic app icons in the taskbar app_wrapper ---
async function renderTaskbarAppIcons() {
    const wrapper = document.getElementById('taskbar_app_icons');
    wrapper.innerHTML = '';
    // Get visible and all app lists
    const visibleRes = await fetch('/list-apps');
    const visibleApps = await visibleRes.json();
    const allRes = await fetch('/list-apps?all=true');
    const allApps = await allRes.json();
    // Find invisible apps (in allApps but not in visibleApps)
    const invisibleAppIds = allApps.filter(x => !visibleApps.includes(x));
    appTemplates.forEach(app => {
        const isOpen = openApps.find(a => a.id === app.id);
        if (
            (app.fullscreen === false && app.type !== 'background') &&
            (!app.invisible || isOpen)
        ) {
            const icon = document.createElement('div');
            icon.className = 'taskbar-app-icon fade-hover';
            // If app is invisible (not in visibleApps), add app_invisible class
            if (invisibleAppIds.includes(app.id) && !isOpen) {
                icon.classList.add('app_invisible');
            }
            if (app.icon && app.icon.endsWith('.png')) {
                icon.innerHTML = `<img src="${app.icon}" alt="${app.name}" onerror="this.onerror=null;this.src='${app.iconFallback}'" class="fade-icon" />`;
            } else {
                icon.innerHTML = `<i data-lucide="${app.icon || 'globe'}"></i>`;
            }
            icon.title = app.name;
            icon.id = 'taskbar_icon_' + app.id;
            icon.onclick = () => openApp(app.id);
            if (isOpen) {
                icon.classList.add('open-indicator');
            }
            wrapper.appendChild(icon);
        }
    });
    lucide.createIcons();
}

// On DOMContentLoaded, load dynamic apps then re-render launcher
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    animatePills();
    setupTooltips();
    // Update time
    function updateTime() {
        const now = new Date();
        document.getElementById('time_currently').textContent = 
            now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('date_currently').textContent = 
            now.toLocaleDateString([], {day: '2-digit', month: '2-digit', year: 'numeric'});
    }
    updateTime();
    setInterval(updateTime, 60000);
    await loadDynamicApps();
    renderTaskbarAppIcons();
    // setupAppLauncher(); // <-- remove this line
    setupAppScaling();
    setupWindowFocusOnClick();
    // Redirect to login if not authenticated (client-side fallback)
    fetch('/api/whoami', { credentials: 'include' })
        .then(res => {
            if (res.status === 401) {
                window.location.href = '/login';
            }
        })
        .catch(() => {
            window.location.href = '/login';
        });
});

// --- Simple Terminal App using Xterm.js and node-pty ---
if (window.location.pathname.includes('terminal.html')) {
    const termContainer = document.getElementById('terminal');
    const term = new window.Terminal({
        cursorBlink: true,
        fontFamily: 'monospace',
        fontSize: 16,
        theme: { background: '#181818', foreground: '#e0e0e0' }
    });
    term.open(termContainer);
    term.focus();
    let cwd = '/';
    let prompt = () => `olive@oliveos:${cwd}$ `;
    let buffer = '';
    function printPrompt() {
        term.write('\r\n' + prompt());
    }
    function runCommand(cmd) {
        const args = cmd.trim().split(/\s+/);
        const command = args[0];
        switch (command) {
            case 'help':
                term.writeln('\r\nAvailable commands: help, clear, echo, ls, cd, pwd, date, whoami, about, exit');
                break;
            case 'clear':
                term.clear();
                break;
            case 'echo':
                term.writeln(args.slice(1).join(' '));
                break;
            case 'ls':
                term.writeln('Desktop  Documents  Downloads  Music  Pictures  Videos');
                break;
            case 'cd':
                if (args[1]) {
                    if (args[1] === '..') {
                        cwd = cwd === '/' ? '/' : cwd.split('/').slice(0, -1).join('/') || '/';
                    } else {
                        cwd = cwd === '/' ? `/${args[1]}` : `${cwd}/${args[1]}`;
                    }
                }
                break;
            case 'pwd':
                term.writeln(cwd);
                break;
            case 'date':
                term.writeln(new Date().toString());
                break;
            case 'whoami':
                term.writeln('olive');
                break;
            case 'about':
                term.writeln('OliveOS Terminal - Simulated shell.');
                break;
            case 'exit':
                term.writeln('logout');
                setTimeout(() => window.close(), 500);
                break;
            case 'olive':
                term.writeln(
`.:^~~~!!!~~~^:.            olive@oliveos\n       :^!!!!!!!!!~^^:::^^^:         --------------------------\n    .^!!!!!!!!!!^.         .:^.      OS:      Win32\n   ^!!!!!!!!!!~.             .~:     Host:    localhost\n  ~!!!!!!!!!!~                 ~^    Kernel:  Mozilla/5.0 (Windows NT 1...\n ~!!!!!!!!~~!^                 ^~^   Uptime:  0s\n^!!!!!!!~~~~~~                 ^~~:  Packages: 42 (npm)\n!!!!!!~~~~~~~~^               ^~^^^  Shell:   simulated\n~!!~~~~~~~~~~~~~:           .^~^^^^  Resolution: 1536x864\n^!~~~~~~~~~~~~~~~~^:.....:^~~^^^^^:  DE:      OliveOS Desktop Environment\n ~!~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^   WM:      Olivindo 1.0\n  ~!~~~~~~~~~~~~~~~~~~^^^^^^^^^^^    WM Theme: Default Theme - Dark\n   ^~~~~~~~~~~~~~~~~~^^^^^^^^^^:     Terminal: OliveOS Terminal / UNIX like\n    .^~~~~~~~~~~~~^^^^^^^^^^^:       Terminal Font: Monospace\n       .^~~~~~~~~^^^^^^^^^:.         CPU:     N/A\n          ..:^^^^^^^^::.             GPU:     N/A\n                                     Memory:  N/A\n                                     Network: N/A\n\n                `);
                break;
            default:
                if (command.trim() !== '')
                    term.writeln(`${command}: command not found`);
        }
    }
    printPrompt();
    term.onData(data => {
        for (let ch of data) {
            if (ch === '\r') {
                runCommand(buffer);
                buffer = '';
                printPrompt();
            } else if (ch === '\u007F') { // Backspace
                if (buffer.length > 0) {
                    buffer = buffer.slice(0, -1);
                    term.write('\b \b');
                }
            } else if (ch >= ' ' && ch <= '~') {
                buffer += ch;
                term.write(ch);
            }
        }
    });
}