// Device info utilities for OliveOS Terminal
export function getDeviceInfo() {
  return {
    gpu: getGPU(),
    cpu: getCPU(),
    mem: getMEM(),
    net: getNET(),
  };
}

function getCPU() {
  const cpu = {
    cores: navigator.hardwareConcurrency || 4,
  };
  return cpu;
}

const GPU_VENDOR_REGEX = /(intel|nvidia|sis|amd|apple|powervr)\W? (.+)/i;
const GPU_RENDERER_REGEX = /(((?:radeon|adreno|geforce|mali).+))/i;
const GPU_CLEANUP_REGEX = / ?(\(.+?\)| direct3d.+| opengl.+|\/.+$| gpu$)/gi;

function getGPU() {
  const gpu = {
    supported: "WebGLRenderingContext" in globalThis,
    active: false,
    vendor: undefined,
    model: undefined,
  };
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");
  if (!gl) return gpu;
  gpu.active = true;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (!info) return gpu;
  gpu.vendor = gl.getParameter(info.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "";
  const vendorMathes = renderer.match(GPU_VENDOR_REGEX);
  const modelMathes = renderer.match(GPU_RENDERER_REGEX);
  if (vendorMathes) gpu.vendor = vendorMathes[1];
  gpu.model = modelMathes ? modelMathes[1] : renderer;
  gpu.model = gpu.model?.replace(GPU_CLEANUP_REGEX, "");
  return gpu;
}

function getMEM() {
  const nav = navigator;
  return { kb: (nav.deviceMemory || 1) * 1024 ** 3 };
}

function getNET() {
  const connection = navigator.connection;
  if (!connection) return defaultNetwork;
  return connection;
}

const defaultNetwork = {
  downlink: 0,
  effectiveType: "0G",
  rtt: 0,
  saveData: false,
  online: false,
};
