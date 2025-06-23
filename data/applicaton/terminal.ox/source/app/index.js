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

// This file is intentionally left blank for the terminal app.

// Remove device info simulation, restore olive command to simple info
// In runCommand (inside terminal.ox app), replace 'olive' command logic:
// case 'olive':
//   term.writeln('OliveOS Terminal - Simulated shell.\nCopyright (c) 2023-2025 OliveOS.');
//   break;
function runCommand(command, term) {
    switch (command) {
        case 'olive': {
            // Gather dynamic info
            const os = navigator.platform || 'Unknown';
            const host = location.hostname || 'localhost';
            const kernel = navigator.userAgent || 'Unknown';
            const uptime = (window.performance && performance.now) ? Math.floor(performance.now() / 1000) + 's' : 'N/A';
            const packages = '42 (npm)'; // You can make this dynamic if you track installed packages
            const shell = 'simulated';
            const resolution = window.screen ? `${window.screen.width}x${window.screen.height}` : 'N/A';
            const de = 'OliveOS Desktop Environment';
            const wm = 'Olivindo 1.0';
            const wmTheme = 'Default Theme - Dark';
            const terminal = 'OliveOS Terminal / UNIX like';
            const terminalFont = 'Monospace';
            const cpu = 'N/A';
            const gpu = 'N/A';
            const memory = (navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A');
            const network = (navigator.onLine ? 'Online' : 'Offline');
            term.writeln(
`.:^~~~!!!~~~^:.            olive@oliveos
       :^!!!!!!!!!~^^:::^^^:         --------------------------
    .^!!!!!!!!!!^.         .:^.      OS:      ${os}
   ^!!!!!!!!!!~.             .~:     Host:    ${host}
  ~!!!!!!!!!!~                 ~^    Kernel:  ${kernel}
 ~!!!!!!!!~~!^                 ^~^   Uptime:  ${uptime}
^!!!!!!!~~~~~~                 ^~~:  Packages: ${packages}
!!!!!!~~~~~~~~^               ^~^^^  Shell:   ${shell}
~!!~~~~~~~~~~~~~:           .^~^^^^  Resolution: ${resolution}
^!~~~~~~~~~~~~~~~~^:.....:^~~^^^^^:  DE:      ${de}
 ~!~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^   WM:      ${wm}
  ~!~~~~~~~~~~~~~~~~~~^^^^^^^^^^^    WM Theme: ${wmTheme}
   ^~~~~~~~~~~~~~~~~~^^^^^^^^^^:     Terminal: ${terminal}
    .^~~~~~~~~~~~~^^^^^^^^^^^:       Terminal Font: ${terminalFont}
       .^~~~~~~~~^^^^^^^^^:.         CPU:     ${cpu}
          ..:^^^^^^^^::.             GPU:     ${gpu}
                                     Memory:  ${memory}
                                     Network: ${network}

                `);
            break;
        }
        // Add other cases here as needed
        default:
            term.writeln('Unknown command: ' + command);
    }
}
