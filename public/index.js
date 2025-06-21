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
    // Icon fallback logic: try main, fallback if error
    let iconHtml = '';
    if (app.icon && app.icon.endsWith('.png')) {
        iconHtml = `<img src="${app.icon}" alt="${app.name}" onerror="this.onerror=null;this.src='${app.iconFallback}'" class="fade-icon" />`;
    } else {
        iconHtml = `<i data-lucide="${app.icon}"></i>`;
    }
    win.innerHTML = `
        <div class="head_m drag_handle">
            <div class="buttons_control">
                <button data-tooltip="Close the window" class="close_b_a_m fade-hover"><i data-lucide="x"></i></button>
                <button data-tooltip="Minimize the window" class="min_b_a_m fade-hover"><i data-lucide="minimize-2"></i></button>
                <button data-tooltip="Maximize the window" class="windowcontrol_b_a_m fade-hover" disabled><i data-lucide="maximize-2"></i></button>
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
    // Animate in
    setTimeout(() => win.classList.add('show-app'), 10);
    // Button events
    win.querySelector('.close_b_a_m').onclick = () => closeApp(app.id);
    win.querySelector('.min_b_a_m').onclick = () => minimizeApp(app.id);
    // Maximize button is disabled for now
    // Add drag events
    makeWindowDraggable(win);
    return win;
}

function makeWindowDraggable(win) {
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
    if (win) win.classList.add('minimized');
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
                result[section][k] = v;
            }
        });
        return result;
    }
    // Find all app folders
    const appRoot = 'data/applicaton';
    const res = await fetch('/list-apps'); // Custom endpoint to list app folders
    const appFolders = await res.json();
    for (const folder of appFolders) {
        try {
            const manifestRes = await fetch(`/${appRoot}/${folder}/@manifest.oman`);
            if (!manifestRes.ok) continue;
            const manifestText = await manifestRes.text();
            const manifest = parseOman(manifestText);
            // Get @app.oman for sources
            const appOmanRes = await fetch(`/${appRoot}/${folder}/source/app/@app.oman`);
            const appOmanText = appOmanRes.ok ? await appOmanRes.text() : '';
            const appOman = parseOman(appOmanText);
            // Compose app info
            const appId = manifest.app?.id || folder;
            const appName = manifest.app?.name || folder;
            // Fix: Clean up workingDir and htmlFile
            let workingDir = manifest.runtime?.working_directory || '/source/app/';
            workingDir = workingDir.trim().replace(/\\/g, '/').replace(/\s+/g, '');
            // Remove trailing slash for workingDir
            if (workingDir.endsWith('/')) workingDir = workingDir.slice(0, -1);
            // Compose iframe path using @app.oman sources
            let htmlFile = 'index.html';
            if (appOman.sources) {
                // Find the first file that exists in sources
                for (const key in appOman.sources) {
                    if (appOman.sources[key]) {
                        htmlFile = appOman.sources[key].trim().replace(/\\/g, '/').replace(/\s+/g, '');
                        if (htmlFile.startsWith('/')) htmlFile = htmlFile.slice(1);
                        break;
                    }
                }
            }
            // Compose iframe path
            let iframePath = `/${appRoot}/${folder}` + (workingDir ? `/${workingDir}` : '') + `/${htmlFile}`;
            // Fix double slashes in iframePath except after http(s):
            iframePath = iframePath.replace(/\\/g, '/').replace(/\s+/g, '');
            iframePath = iframePath.replace(/([^:])\/+/g, '$1/');
            // Try both possible icon locations
            let appIcon = undefined;
            // 1. Try /assets/icon.png (old location)
            let iconPath1 = `/${appRoot}/${folder}/assets/icon.png`;
            // 2. Try /source/assets/icon.png (new location)
            let iconPath2 = `/${appRoot}/${folder}/source/assets/icon.png`;
            // We'll check if the file exists later in the UI, but prefer iconPath2 if it exists
            appIcon = iconPath2;
            // Set default width/height if not defined
            let width = manifest.window?.width ? parseInt(manifest.window.width) : 700;
            let height = manifest.window?.height ? parseInt(manifest.window.height) : 400;
            // Set default resizable/fullscreen if not defined
            let resizable = manifest.window?.resizable !== undefined ? manifest.window.resizable === 'true' : true;
            let fullscreen = manifest.window?.fullscreen !== undefined ? manifest.window.fullscreen === 'true' : false;
            // Register app in appTemplates
            appTemplates.push({
                id: appId,
                name: appName,
                icon: appIcon,
                iconFallback: iconPath1,
                iframe: iframePath,
                width,
                height,
                resizable,
                fullscreen
            });
        } catch (e) { console.warn('Failed to load app', folder, e); }
    }
}

// --- Render dynamic app icons in the taskbar app_wrapper ---
function renderTaskbarAppIcons() {
    const wrapper = document.getElementById('taskbar_app_icons');
    wrapper.innerHTML = '';
    appTemplates.forEach(app => {
        // Only show launchers for non-background apps
        if (app.fullscreen === false && app.type !== 'background') {
            const icon = document.createElement('div');
            icon.className = 'taskbar-app-icon fade-hover';
            if (app.icon && app.icon.endsWith('.png')) {
                icon.innerHTML = `<img src="${app.icon}" alt="${app.name}" onerror="this.onerror=null;this.src='${app.iconFallback}'" class="fade-icon" />`;
            } else {
                icon.innerHTML = `<i data-lucide="${app.icon || 'globe'}"></i>`;
            }
            icon.title = app.name;
            icon.onclick = () => openApp(app.id);
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
});