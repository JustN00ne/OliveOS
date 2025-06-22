// Device info utilities for OliveOS Terminal
export function getDeviceInfo() {
  // Get hostname and trim if too long
  let host = window.location.hostname || '';
  if (host.length > 20) host = host.slice(0, 17) + '...';
  return {
    gpu: {},
    cpu: { cores: navigator.hardwareConcurrency || 4 },
    mem: { kb: (navigator.deviceMemory || 1) * 1024 ** 3 },
    net: {},
    host,
  };
}
