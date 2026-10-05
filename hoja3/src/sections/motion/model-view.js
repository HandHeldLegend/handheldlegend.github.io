/**
 * model-view.js — Live 3D controller model driven by the gyro (port of hoja2's
 * components/sensor-visualization.js).
 *
 *   const view = createModelView({ bodyColor: 0x8e7cc3 });
 *   container.append(view.el);
 *   view.setGyro(r.gyro);      // raw int16 gyro sample from the input report
 *   view.destroy();            // stops rendering and frees all WebGL resources
 *
 * three.js (r128, classic UMD build) and its STLLoader are vendored in /vendor/three and loaded
 * lazily with <script> tags the first time the Motion page opens; they define `window.THREE`.
 *
 * Behavior copied from hoja2 so the model moves exactly as before:
 *   - gyro dps = raw × 70 mdps/LSB (LSM6DSR at ±2000 dps), with the X axis negated;
 *   - target rotation (deg) = dps × 0.25 + rotation offset (0,0,0) — the model tilts in proportion to
 *     how fast you turn the controller, it does not integrate an absolute orientation;
 *   - each frame the rotation eases 5 % toward the target and the stored rate decays 1 % toward 0
 *     (both normalized here to a 60 fps frame so 120 Hz displays behave the same as hoja2 at 60 Hz);
 *   - orthographic camera (frustum 10, z = 10), model centered and scaled 2.5×, Phong material
 *     (shininess = reflectivity 0.16 × 100), ambient + four directional lights (dimmed, see
 *     KEY_LIGHT_INTENSITY).
 *
 * Reduced motion: the model has no autonomous animation (no idle spin or auto-rotation) — it only
 * moves when the physical controller moves, so nothing needs to be switched off.
 *
 * New in hoja3: transparent background, theme-aware lighting/fallback color (re-read on theme
 * change), rendering pauses while the tab is hidden or the stage is scrolled off-screen, and
 * everything is disposed in destroy().
 */
import { h } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';

const THREE_URL = new URL('../../../vendor/three/three.min.js', import.meta.url).href;
const STL_LOADER_URL = new URL('../../../vendor/three/STLLoader.js', import.meta.url).href;
const MODEL_URL = new URL('../../../assets/3d/supergamepad.stl', import.meta.url).href;

// ---- hoja2 constants ------------------------------------------------------------------------
const GYRO_MDPS_PER_LSB = 70;      // LSM6DSR ±2000 dps
const VIEW_SENSITIVITY = 0.25;     // degrees of tilt per dps
const ROTATION_EASE = 0.05;        // per-frame lerp toward the target rotation
const RETURN_SPEED = 0.01;         // per-frame decay of the last gyro rate toward 0
const MODEL_SCALE = 2.5;
const ROTATION_OFFSET = { x: 0, y: 0, z: 0 };
const REFLECTIVITY = 0.16;
const FRUSTUM = 10;
const DESIGN_ASPECT = 340 / 224;   // hoja2's fixed canvas size; narrower stages widen the frustum
// hoja2 used 0.5 per directional light, which (with four lights + ambient) blows light body colors
// out to white. Same rig and positions at 0.2 each, so the controller's own color reads true.
const KEY_LIGHT_INTENSITY = 0.2;

// ---- Lazy library loading -------------------------------------------------------------------
let threePromise = null;
let stlBytesPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(s);
  });
}

/** Load three.js + STLLoader once per page lifetime. Resolves to window.THREE. */
export function loadThree() {
  if (!threePromise) {
    threePromise = (async () => {
      if (!window.THREE) await loadScript(THREE_URL);
      if (!window.THREE.STLLoader) await loadScript(STL_LOADER_URL);
      return window.THREE;
    })();
    threePromise.catch(() => { threePromise = null; }); // allow a retry on the next mount
  }
  return threePromise;
}

/** Fetch the STL bytes once; each mount parses its own geometry so it can be disposed. */
function loadModelBytes() {
  if (!stlBytesPromise) {
    stlBytesPromise = fetch(MODEL_URL).then((res) => {
      if (!res.ok) throw new Error(`Model HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    stlBytesPromise.catch(() => { stlBytesPromise = null; });
  }
  return stlBytesPromise;
}

// ---- Theme colors --------------------------------------------------------------------------
let probeCtx = null;

/**
 * Resolve any CSS color (custom property, color-mix(), …) to 0xRRGGBB using a 1×1 canvas,
 * which handles every syntax the browser understands. Alpha is composited over black.
 */
function cssColorToHex(el, varName, fallback) {
  const value = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!value) return fallback;
  if (!probeCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    probeCtx = c.getContext('2d', { willReadFrequently: true });
  }
  // Paint opaque black first so translucent colors resolve as "mixed toward black".
  probeCtx.globalCompositeOperation = 'source-over';
  probeCtx.fillStyle = '#000';
  probeCtx.fillRect(0, 0, 1, 1);
  probeCtx.fillStyle = value;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

/**
 * @param {{bodyColor?: number|null}} [o] bodyColor: controller body color 0xRRGGBB
 *   (gamepad_color_body, as hoja2 used); null/0 falls back to the theme's --motion-model color.
 * @returns {{el: HTMLElement, setGyro: (g:{x:number,y:number,z:number}) => void, destroy: () => void}}
 */
export function createModelView(o = {}) {
  const canvas = h('canvas.motion-canvas', { 'aria-hidden': 'true' });
  const status = h('div.motion-stage-status', h('span.spinner.motion-ok'), h('span', t('Loading 3D view…')));
  const el = h('div.motion-stage', { role: 'img', 'aria-label': t('Live 3D view of the controller, tilting as you move it') },
    canvas, status);

  // Last gyro rate in dps (hoja2 _lastData.gyro).
  const rate = { x: 0, y: 0, z: 0 };
  let destroyed = false;
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let model = null;
  let material = null;
  let ambient = null;
  let raf = 0;
  let lastFrame = 0;
  let onScreen = true;
  const cleanups = [];

  function setGyro(g) {
    const k = GYRO_MDPS_PER_LSB / 1000;
    rate.x = -g.x * k;
    rate.y = g.y * k;
    rate.z = g.z * k;
  }

  function applyTheme() {
    if (!material) return;
    const body = o.bodyColor ? o.bodyColor & 0xffffff : null;
    material.color.setHex(body ?? cssColorToHex(el, '--motion-model', 0x8e7cc3));
    material.specular.setHex(cssColorToHex(el, '--motion-specular', 0x111111));
    ambient.color.setHex(cssColorToHex(el, '--motion-ambient', 0x666666));
    material.needsUpdate = true;
    renderOnce();
  }

  function resize() {
    if (!renderer) return;
    const w = Math.max(1, el.clientWidth);
    const hgt = Math.max(1, el.clientHeight);
    renderer.setSize(w, hgt, false);
    const aspect = w / hgt;
    // Keep hoja2's framing; if the stage is narrower than hoja2's 340×224, grow the frustum so
    // the controller still fits horizontally.
    const size = FRUSTUM * Math.max(1, DESIGN_ASPECT / aspect);
    camera.left = (-size * aspect) / 2;
    camera.right = (size * aspect) / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
    camera.updateProjectionMatrix();
    renderOnce();
  }

  function renderOnce() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const deg = (d) => (d * Math.PI) / 180;

  function frame(now) {
    raf = 0;
    if (destroyed || !model) return;
    // hoja2 ran its lerps once per animation frame; scale them so any refresh rate matches 60 fps.
    const frames = lastFrame ? Math.min(4, (now - lastFrame) / (1000 / 60)) : 1;
    lastFrame = now;
    const ease = 1 - (1 - ROTATION_EASE) ** frames;
    const decay = 1 - (1 - RETURN_SPEED) ** frames;

    model.rotation.x = lerp(model.rotation.x, deg(rate.x * VIEW_SENSITIVITY + ROTATION_OFFSET.x), ease);
    model.rotation.y = lerp(model.rotation.y, deg(rate.y * VIEW_SENSITIVITY + ROTATION_OFFSET.y), ease);
    model.rotation.z = lerp(model.rotation.z, deg(rate.z * VIEW_SENSITIVITY + ROTATION_OFFSET.z), ease);
    rate.x = lerp(rate.x, 0, decay);
    rate.y = lerp(rate.y, 0, decay);
    rate.z = lerp(rate.z, 0, decay);

    renderOnce();
    schedule();
  }

  /** Run the loop only while the page is visible and the stage is on screen. */
  function schedule() {
    if (destroyed || raf || !model || document.hidden || !onScreen) return;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
  }

  function buildMaterial() {
    return new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: REFLECTIVITY * 100, specular: 0x111111 });
  }

  async function init() {
    THREE = await loadThree();
    if (destroyed) return;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (err) {
      console.warn('[motion] WebGL unavailable', err);
      status.replaceChildren(h('span', '3D view unavailable — your browser or GPU has WebGL turned off.'));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0); // transparent: the card surface shows through

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.z = 10;

    material = buildMaterial();
    let geometry;
    try {
      const bytes = await loadModelBytes();
      if (destroyed) { material.dispose(); return; }
      geometry = new THREE.STLLoader().parse(bytes);
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    } catch (err) {
      if (destroyed) return;
      console.warn('[motion] STL model failed to load, using a cube', err);
      geometry = new THREE.BoxGeometry(2, 2, 2); // hoja2 createFallbackCube()
    }

    model = new THREE.Mesh(geometry, material);
    model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
    model.rotation.set(deg(ROTATION_OFFSET.x), deg(ROTATION_OFFSET.y), deg(ROTATION_OFFSET.z));
    scene.add(model);

    // hoja2 lighting rig: ambient + front/left/right/top directional lights.
    ambient = new THREE.AmbientLight(0x666666);
    scene.add(ambient);
    for (const [x, y, z] of [[0, 0, 10], [-8, 0, 8], [8, 0, 8], [0, 8, 8]]) {
      const light = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
      light.position.set(x, y, z);
      scene.add(light);
    }

    status.remove();
    applyTheme();

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    cleanups.push(() => ro.disconnect());

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) schedule(); else pause();
    });
    io.observe(el);
    cleanups.push(() => io.disconnect());

    const onVisibility = () => (document.hidden ? pause() : schedule());
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // Theme: explicit data-theme switches and OS changes in "system" mode.
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', applyTheme);
    cleanups.push(() => { mo.disconnect(); mq.removeEventListener('change', applyTheme); });

    resize();
    schedule();
  }

  init().catch((err) => {
    if (destroyed) return;
    console.error('[motion] 3D view failed', err);
    status.replaceChildren(h('span', t('The 3D view could not be loaded.')));
  });

  function destroy() {
    destroyed = true;
    pause();
    for (const fn of cleanups.splice(0)) fn();
    if (scene) {
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          [].concat(obj.material || []).forEach((m) => m.dispose());
        }
      });
      scene.clear?.();
    }
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss(); // release the WebGL context now rather than at GC
    }
    renderer = scene = camera = model = material = ambient = null;
  }

  return { el, setGyro, destroy };
}
