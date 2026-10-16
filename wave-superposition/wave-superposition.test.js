'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, 'wave-superposition-sim.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'wave-superposition.js'), 'utf8');
let checks = 0;
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
  checks += 1;
}

function createHarness() {
  const counts = { sin: 0, drawImage: 0, grid: 0, stroke: 0, fill: 0 };
  function drawingContext(grid = false) {
    return new Proxy({}, {
      get: (_, key) => (...args) => {
        if (key === 'drawImage') counts.drawImage += 1;
        if (key === 'fillRect' && grid) counts.grid += 1;
        if (key === 'stroke' && !grid) counts.stroke += 1;
        if (key === 'fill' && !grid) counts.fill += 1;
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg));
      },
      set: () => true
    });
  }
  function element(id = '') {
    const classes = new Set();
    const captured = new Set();
    return {
      id, value: '', min: '', max: '', dataset: {}, attributes: {}, events: {},
      style: { setProperty() {} },
      classList: {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); }
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      setPointerCapture(id) { captured.add(id); },
      hasPointerCapture(id) { return captured.has(id); },
      releasePointerCapture(id) { captured.delete(id); },
      addEventListener(name, callback) { this.events[name] = callback; }
    };
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], element(match[1])]));
  for (const input of html.matchAll(/<input\b[^>]+>/g)) {
    const attrs = Object.fromEntries([...input[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
    Object.assign(elements.get(attrs.id), attrs);
  }
  const presetButtons = ['standing', 'beats', 'cancel'].map((preset) => Object.assign(element(), { dataset: { preset } }));
  const canvas = elements.get('waveCanvas');
  const rect = { width: 978, height: 300, left: 0, top: 0 };
  canvas.getBoundingClientRect = () => rect;
  canvas.getContext = () => drawingContext();
  const document = {
    hidden: false, events: {},
    getElementById(id) { assert.ok(elements.has(id), `Unknown element: ${id}`); return elements.get(id); },
    createElement(tag) { assert.equal(tag, 'canvas'); return { getContext: () => drawingContext(true) }; },
    querySelectorAll(selector) { assert.equal(selector, '.preset-btn'); return presetButtons; },
    addEventListener(name, callback) { this.events[name] = callback; }
  };
  const pending = new Map();
  let nextId = 1;
  const math = Object.create(Math);
  math.sin = (value) => { counts.sin += 1; return Math.sin(value); };
  const context = vm.createContext({
    document, Math: math,
    window: { devicePixelRatio: 2, matchMedia: () => ({ matches: true }), addEventListener() {} },
    requestAnimationFrame(callback) { const id = nextId++; pending.set(id, callback); return id; },
    cancelAnimationFrame(id) { pending.delete(id); }
  });
  const app = vm.runInContext(script + '\n;({state, world, view, series, waveValue, sampleFrame, draw, resizeCanvas, setRunning, step, invertWave, resetTime, applyPreset, yToPx});', context);
  return {
    ...app, counts, pending, rect, document, elements,
    frame(timestamp) {
      assert.equal(pending.size, 1, 'Only one animation callback may be pending');
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      callback(timestamp);
    }
  };
}

// Rendering follows the display clock, including timestamps starting at zero.
for (const hz of [30, 60, 120]) {
  const app = createHarness();
  app.setRunning(true);
  const initialDraws = app.counts.drawImage;
  for (let i = 0; i <= hz * 2; i += 1) app.frame(i * 1000 / hz);
  assert.equal(app.counts.drawImage - initialDraws, hz * 2 + 1);
  near(app.state.t, 2);
  app.setRunning(false);
  assert.equal(app.pending.size, 0, 'Pausing must cancel RAF immediately');
  console.log(`Display clock ${hz} Hz: ${hz} frames/s, simulated time ${app.state.t.toFixed(3)} s`);
}

const app = createHarness();
const { state, waveValue } = app;
const right = { amp: 0.5, freq: 0.4, vel: 2.4, phase: 0 };
const left = { ...right, vel: -2.4 };
assert.equal(waveValue(right, 6, 2.49).active, false);
assert.equal(waveValue(left, 6, 2.49).active, false);
assert.equal(waveValue(right, 6, 2.5).active, true);
assert.equal(waveValue({ ...right, vel: 0 }, 0, 5).active, false);
for (let t = 0; t <= 20; t += 0.125) {
  for (let x = 0; x <= 12; x += 0.15) {
    near(waveValue(right, x, t).y, waveValue(left, 12 - x, t).y);
  }
}

// Preserve causality, superposition, destructive interference and envelope bounds.
for (const preset of ['standing', 'beats', 'cancel']) {
  app.applyPreset(preset);
  state.showEnvelope = true;
  for (const t of [0, 0.1, 2.5, 5, 10.3, 100]) {
    state.t = t;
    app.sampleFrame();
    for (let i = 0; i < 81; i += 1) {
      const p = app.series.sum[i];
      near(p.y, waveValue(state.wave1, p.x, t).y + waveValue(state.wave2, p.x, t).y);
      assert.ok(Number.isFinite(app.series.upper[i].y));
      assert.ok(Math.abs(p.y) <= 1 + 1e-9);
      if (preset === 'cancel') near(p.y, 0);
      if (t >= 5) assert.ok(Math.abs(p.y) <= app.series.upper[i].y + 1e-9);
    }
  }
}

app.applyPreset('standing');
state.t = 10.3;
state.showEnvelope = true;
const before = { ...app.counts };
app.draw();
assert.equal(app.counts.sin - before.sin, 162, 'Each of two waves is sampled once per medium point');
assert.equal(app.counts.grid, before.grid, 'The grid is cached between frames');
assert.ok(app.counts.stroke - before.stroke < 25, 'Medium-point strokes must be batched');
assert.equal(app.counts.fill - before.fill, 3, 'Sum points, selected sum point and axis marker use three filled paths');

for (const height of [240, 280, 300, 360]) {
  app.rect.height = height;
  state.wave1.amp = state.wave2.amp = 1.2;
  const previousTime = state.t;
  app.resizeCanvas();
  assert.ok(app.yToPx(2.4) >= 21.99, 'Maximum positive displacement stays visible');
  assert.ok(app.yToPx(-2.4) <= height - 21.99, 'Maximum negative displacement stays visible');
  near(state.t, previousTime);
}

const range = app.elements.get('amp1Range');
range.value = '0.85';
range.events.input();
near(state.wave1.amp, 0.85);
near(Number(app.elements.get('amp1Number').value), 0.85);
assert.equal(state.preset, 'custom');
app.invertWave('wave1');
near(state.wave1.phase, Math.PI);
app.invertWave('wave1');
near(state.wave1.phase, 0);
app.resetTime();
near(state.wave1.amp, 0.85);
near(state.t, 0);
app.step(state.dt);
near(state.t, 0.15625);
app.step(-state.dt);
near(state.t, 0);

state.t = 0.03;
state.speed = -1;
app.setRunning(true);
app.frame(100);
app.frame(150);
near(state.t, 0);
assert.equal(state.running, false);
assert.equal(app.pending.size, 0, 'Reverse playback stops at zero');

state.speed = 1;
app.setRunning(true);
app.frame(0);
app.frame(10000);
near(state.t, 0.06, 1e-8);
app.document.hidden = true;
app.document.events.visibilitychange();
assert.equal(app.pending.size, 0);
app.document.hidden = false;
app.document.events.visibilitychange();
app.frame(20000);
near(state.t, 0.06, 1e-8);
app.setRunning(false);

// Page swipes and two-finger gestures must not select a medium point.
const events = app.elements.get('waveCanvas').events;
state.hasSelection = false;
const pointer = { pointerId: 1, clientX: 300, clientY: app.rect.height / 2, isPrimary: true, button: 0, preventDefault() {} };
events.pointerdown(pointer);
events.pointermove({ ...pointer, clientY: pointer.clientY + 40 });
events.pointerup(pointer);
assert.equal(state.hasSelection, false);
events.pointerdown(pointer);
events.pointerdown({ ...pointer, pointerId: 2, isPrimary: false });
events.pointerup(pointer);
events.pointerup({ ...pointer, pointerId: 2 });
assert.equal(state.hasSelection, false);
events.pointerdown(pointer);
events.pointerup(pointer);
assert.equal(state.hasSelection, true);
assert.equal(app.pending.size, 0);

// The full-height transparent handle drags relative to the starting point, without pausing.
const handle = app.elements.get('probeHandle');
assert.equal(handle.style.height, `${app.view.height - 40}px`);
const startIndex = state.selectedIndex;
const startX = Number(handle.attributes['aria-valuenow']);
const dragDistance = (app.view.width - 2 * app.world.paddingX) / 4;
app.setRunning(true);
handle.events.pointerdown({ ...pointer, clientX: 320, clientY: 25 });
assert.equal(handle.hasPointerCapture(1), true);
assert.equal(state.selectedIndex, startIndex, 'Grabbing the edge of a handle must not move it');
handle.events.pointermove({ ...pointer, clientX: 320 + dragDistance, clientY: 25 });
assert.equal(state.selectedIndex, startIndex + 20);
near(Number(handle.attributes['aria-valuenow']), startX + 3);
assert.equal(state.running, true);
assert.equal(app.pending.size, 1);
handle.events.pointerup({ ...pointer, clientX: 320 + dragDistance, clientY: 25 });
assert.equal(handle.hasPointerCapture(1), false);
handle.events.pointermove({ ...pointer, clientX: -100 });
assert.equal(state.selectedIndex, startIndex + 20);
handle.events.pointerdown({ ...pointer, isPrimary: false, pointerId: 2 });
assert.equal(handle.hasPointerCapture(2), false);

handle.events.pointerdown(pointer);
handle.events.pointercancel(pointer);
handle.events.pointermove({ ...pointer, clientX: 1000 });
assert.equal(state.selectedIndex, startIndex + 20);
handle.events.keydown({ key: 'Home', preventDefault() {} });
assert.equal(state.selectedIndex, 0);
assert.ok(Number.parseFloat(handle.style.left) >= 22, 'The full touch target stays inside the plot at the left endpoint');
handle.events.keydown({ key: 'ArrowRight', preventDefault() {} });
assert.equal(state.selectedIndex, 1);
handle.events.keydown({ key: 'End', preventDefault() {} });
assert.equal(state.selectedIndex, 80);
assert.ok(Number.parseFloat(handle.style.left) <= app.view.width - 22, 'The full touch target stays inside the plot at the right endpoint');
handle.events.keydown({ key: 'ArrowRight', preventDefault() {} });
assert.equal(state.selectedIndex, 80);
handle.events.keydown({ key: 'ArrowLeft', preventDefault() {} });
assert.equal(state.selectedIndex, 79);
state.showSum = state.showWave1 = state.showWave2 = false;
handle.events.pointerdown(pointer);
handle.events.pointermove({ ...pointer, clientX: -1000 });
assert.equal(state.selectedIndex, 0, 'The probe remains movable with all waves hidden');
handle.events.pointerup({ ...pointer, clientX: -1000 });
const probeTime = state.t;
app.rect.width = 720;
app.rect.height = 360;
app.resizeCanvas();
assert.equal(state.selectedIndex, 0);
near(state.t, probeTime);
assert.equal(handle.style.height, '320px');
assert.equal(app.pending.size, 1);
app.setRunning(false);
assert.equal(app.pending.size, 0);
console.log(`Superposition tests passed (${checks} numeric checks plus rendering, controls and gesture checks).`);
