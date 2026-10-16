'use strict';

const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const gridCanvas = document.createElement('canvas');
const gridCtx = gridCanvas.getContext('2d', { alpha: false });
const view = { width: 0, height: 0, dpr: 1 };
const world = { minX: 0, maxX: 12, pointCount: 81, ampScale: 82, paddingX: 22 };
const colors = {
  wave1: '#c44232', wave2: '#235eaa', sum: '#13824f', envelope: '#7951a8',
  axis: 'rgba(23, 49, 60, 0.38)', grid: 'rgba(23, 49, 60, 0.1)'
};
const presets = {
  standing: {
    wave1: { amp: 0.5, freq: 0.4, vel: 2.4, phase: 0 },
    wave2: { amp: 0.5, freq: 0.4, vel: -2.4, phase: 0 }, showEnvelope: false
  },
  beats: {
    wave1: { amp: 0.5, freq: 1.5, vel: 2.8, phase: 0 },
    wave2: { amp: 0.5, freq: 1.8, vel: 2.8, phase: 0 }, showEnvelope: false
  },
  cancel: {
    wave1: { amp: 0.5, freq: 0.4, vel: 2.4, phase: 0 },
    wave2: { amp: 0.5, freq: 0.4, vel: 2.4, phase: Math.PI }, showEnvelope: false
  }
};
const state = {
  t: 0, dt: 0.15625, speed: 1, running: false, lastTime: null, rafId: 0,
  preset: 'standing', selectedIndex: 40, hasSelection: true,
  showWave1: true, showWave2: true, showSum: true, showEnvelope: false,
  wave1: { ...presets.standing.wave1 }, wave2: { ...presets.standing.wave2 }
};
const bindPairs = [
  ['amp1', 'wave1', 'amp'], ['freq1', 'wave1', 'freq'], ['vel1', 'wave1', 'vel'],
  ['amp2', 'wave2', 'amp'], ['freq2', 'wave2', 'freq'], ['vel2', 'wave2', 'vel']
];
const els = Object.fromEntries([
  'playBtn', 'playLabel', 'backBtn', 'forwardBtn', 'timeValue',
  'showWave1Btn', 'showWave2Btn', 'showSumBtn', 'showEnvelopeBtn', 'probeHandle'
].map((id) => [id, document.getElementById(id)]));
const series = Object.fromEntries(['wave1', 'wave2', 'sum', 'upper', 'lower'].map((key) => [
  key, Array.from({ length: world.pointCount }, (_, i) => ({ x: pointX(i), y: 0 }))
]));
let lastTimeLabel = '';

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function pointX(index) { return world.minX + (world.maxX - world.minX) * index / (world.pointCount - 1); }
function xToPx(x) { return world.paddingX + (x - world.minX) / (world.maxX - world.minX) * (view.width - 2 * world.paddingX); }
function pxToX(px) { return world.minX + (px - world.paddingX) / (view.width - 2 * world.paddingX) * (world.maxX - world.minX); }
function yToPx(y) { return view.height * 0.5 - y * world.ampScale; }

function waveValue(wave, x, t) {
  const speed = Math.abs(wave.vel);
  if (speed < 0.001 || wave.amp === 0) return { y: 0, active: false, phase: wave.phase };
  const distance = wave.vel > 0 ? x - world.minX : world.maxX - x;
  if (distance < -0.0001 || t < distance / speed) return { y: 0, active: false, phase: wave.phase };
  const phase = 2 * Math.PI * wave.freq * (t - distance / speed) + wave.phase;
  return { y: wave.amp * Math.sin(phase), active: true, phase };
}

function sampleFrame() {
  // Share one sample of each wave between the lines, medium points and envelope.
  for (let i = 0; i < world.pointCount; i += 1) {
    const x = series.wave1[i].x;
    const v1 = waveValue(state.wave1, x, state.t);
    const v2 = waveValue(state.wave2, x, state.t);
    series.wave1[i].y = v1.y;
    series.wave2[i].y = v2.y;
    series.sum[i].y = v1.y + v2.y;
    if (state.showEnvelope) {
      const a = state.wave1.amp;
      const b = state.wave2.amp;
      const e = v1.active && v2.active
        ? Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos(v1.phase - v2.phase))) : 0;
      series.upper[i].y = e;
      series.lower[i].y = -e;
    }
  }
}

function fitAmplitude() {
  const scale = Math.min(82, Math.max(1, view.height / 2 - 22) / Math.max(1, state.wave1.amp + state.wave2.amp));
  if (scale === world.ampScale) return;
  world.ampScale = scale;
  drawGrid();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(coarse ? 1.35 : 1.75, Math.max(1, window.devicePixelRatio || 1));
  if (rect.width <= 0 || rect.height <= 0) return;
  if (view.width === rect.width && view.height === rect.height && view.dpr === dpr) return;
  Object.assign(view, { width: rect.width, height: rect.height, dpr });
  canvas.width = gridCanvas.width = Math.round(rect.width * dpr);
  canvas.height = gridCanvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitAmplitude();
  drawGrid();
  syncProbeHandle();
  draw();
}

function drawGrid() {
  const { width: w, height: h } = view;
  gridCtx.fillStyle = '#ffffff';
  gridCtx.fillRect(0, 0, w, h);
  gridCtx.strokeStyle = colors.grid;
  gridCtx.lineWidth = 0.65;
  gridCtx.beginPath();
  for (let i = 0; i <= 12; i += 1) {
    const x = xToPx(i);
    gridCtx.moveTo(x, 0);
    gridCtx.lineTo(x, h);
  }
  for (let j = -2; j <= 2; j += 1) {
    const y = yToPx(j * 0.5);
    gridCtx.moveTo(0, y);
    gridCtx.lineTo(w, y);
  }
  gridCtx.stroke();
  gridCtx.strokeStyle = colors.axis;
  gridCtx.lineWidth = 0.85;
  gridCtx.beginPath();
  gridCtx.moveTo(0, h / 2);
  gridCtx.lineTo(w, h / 2);
  gridCtx.stroke();
}

function drawSelectedGuide() {
  if (!state.hasSelection) return;
  const px = xToPx(pointX(state.selectedIndex));
  const top = 20;
  const bottom = view.height - 20;
  ctx.fillStyle = 'rgba(200, 91, 55, 0.1)';
  ctx.fillRect(px - 5, top, 10, bottom - top);
  ctx.strokeStyle = 'rgba(200, 91, 55, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.lineTo(px, bottom);
  ctx.stroke();
}

function syncProbeHandle() {
  const x = pointX(state.selectedIndex);
  els.probeHandle.hidden = !state.hasSelection;
  els.probeHandle.style.left = `${xToPx(x)}px`;
  els.probeHandle.style.top = '20px';
  els.probeHandle.style.height = `${view.height - 40}px`;
  els.probeHandle.setAttribute('aria-valuenow', String(Number(x.toFixed(2))));
  els.probeHandle.setAttribute('aria-valuetext', `x = ${x.toFixed(2)}`);
}

function setProbe(x) {
  state.selectedIndex = clamp(Math.round((x - world.minX) / (world.maxX - world.minX) * (world.pointCount - 1)), 0, world.pointCount - 1);
  state.hasSelection = true;
  syncProbeHandle();
  draw();
}

function drawProbeMarker() {
  if (!state.hasSelection) return;
  const x = xToPx(pointX(state.selectedIndex));
  const y = yToPx(0);
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 6, y);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x - 6, y);
  ctx.closePath();
  ctx.fillStyle = '#c85b37';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function traceLine(points) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const px = xToPx(points[i].x);
    const py = yToPx(points[i].y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

function drawPoints(points, color, radius, filled, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    if (state.hasSelection && i === state.selectedIndex) continue;
    const x = xToPx(points[i].x);
    const y = yToPx(points[i].y);
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  if (filled) ctx.fill();
  else ctx.stroke();
  if (state.hasSelection) {
    const p = points[state.selectedIndex];
    ctx.beginPath();
    ctx.arc(xToPx(p.x), yToPx(p.y), radius + 2.8, 0, Math.PI * 2);
    if (filled) ctx.fill();
    else ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaveLayer(kind, radius, filled, alpha) {
  const points = series[kind];
  ctx.save();
  ctx.strokeStyle = colors[kind];
  ctx.lineJoin = ctx.lineCap = 'round';
  traceLine(points);
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.globalAlpha = filled ? 0.85 : 0.65;
  ctx.lineWidth = filled ? 1.5 : 1.15;
  ctx.stroke();
  ctx.restore();
  drawPoints(points, colors[kind], radius, filled, alpha);
}

function drawEnvelope() {
  ctx.save();
  ctx.strokeStyle = colors.envelope;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([8, 7]);
  traceLine(series.upper); ctx.stroke();
  traceLine(series.lower); ctx.stroke();
  const maxEnvelope = Math.max(...series.upper.map((p) => p.y));
  if (maxEnvelope >= 0.18) {
    ctx.strokeStyle = 'rgba(121, 81, 168, 0.38)';
    ctx.fillStyle = 'rgba(121, 81, 168, 0.08)';
    ctx.setLineDash([4, 6]);
    for (let i = 1; i < series.upper.length - 1; i += 1) {
      const here = series.upper[i].y;
      const prev = series.upper[i - 1].y;
      const next = series.upper[i + 1].y;
      if (here < maxEnvelope * 0.82 || here <= prev || here < next) continue;
      const x = xToPx(series.upper[i].x);
      const top = yToPx(here);
      const bottom = yToPx(-here);
      ctx.fillRect(x - 4, top, 8, bottom - top);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
  }
  ctx.restore();
}

function draw() {
  if (!view.width) return;
  fitAmplitude();
  ctx.drawImage(gridCanvas, 0, 0, view.width, view.height);
  sampleFrame();
  drawSelectedGuide();
  if (state.showEnvelope) drawEnvelope();
  if (state.showWave1) drawWaveLayer('wave1', 1.85, false, 0.52);
  if (state.showWave2) drawWaveLayer('wave2', 1.35, false, 0.52);
  if (state.showSum) drawWaveLayer('sum', 2.8, true, 1);
  drawProbeMarker();
  const label = `t = ${state.running ? (Math.floor(state.t * 10) / 10).toFixed(1) : state.t.toFixed(2)} s`;
  if (label !== lastTimeLabel) {
    els.timeValue.textContent = label;
    lastTimeLabel = label;
  }
}

function updatePlaybackControl() {
  els.playLabel.textContent = state.running ? '一時停止' : '再生';
  els.playBtn.classList.toggle('primary', !state.running);
  els.playBtn.classList.toggle('stop-state', state.running);
  els.backBtn.setAttribute('aria-pressed', String(state.running && state.speed < 0));
  els.forwardBtn.setAttribute('aria-pressed', String(state.running && state.speed > 0));
}

function setRunning(next) {
  state.running = next && !document.hidden;
  state.lastTime = null;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  updatePlaybackControl();
  if (state.running) requestTick();
  else draw();
}

function requestTick() {
  if (!state.rafId && state.running && !document.hidden) state.rafId = requestAnimationFrame(tick);
}

function tick(timestamp) {
  state.rafId = 0;
  if (!state.running || document.hidden) return;
  // RAF already follows the display clock; a strict 1/60 cutoff skips valid frames.
  const elapsed = state.lastTime === null ? 0 : Math.min(0.06, Math.max(0, (timestamp - state.lastTime) / 1000));
  state.lastTime = timestamp;
  state.t = Math.max(0, state.t + elapsed * state.speed);
  if (state.speed < 0 && state.t === 0) {
    setRunning(false);
    return;
  }
  draw();
  requestTick();
}

function step(delta) {
  setRunning(false);
  const direction = Math.sign(delta) || 1;
  const currentSlot = state.t / state.dt;
  const snappedSlot = direction > 0 ? Math.floor(currentSlot + 0.5) + 1 : Math.ceil(currentSlot - 0.5) - 1;
  state.t = Math.max(0, snappedSlot * state.dt);
  draw();
}

function invertWave(waveKey) {
  state[waveKey].phase = (state[waveKey].phase + Math.PI) % (Math.PI * 2);
  markCustom();
  draw();
}

function resetTime() {
  state.t = 0;
  state.speed = 1;
  setRunning(false);
}

function paintRange(range) {
  const pct = (Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min)) * 100;
  range.style.setProperty('--range-fill', range.id.includes('1') ? '#d78f86' : '#80a1cc');
  range.style.setProperty('--range-pct', `${pct}%`);
}

function syncControlsFromState() {
  bindPairs.forEach(([prefix, waveKey, prop]) => {
    const range = document.getElementById(`${prefix}Range`);
    range.value = document.getElementById(`${prefix}Number`).value = state[waveKey][prop];
    paintRange(range);
  });
  updateEnvelopeControl();
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    const active = btn.dataset.preset === state.preset;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function updateEnvelopeControl() {
  ['Wave1', 'Wave2', 'Sum', 'Envelope'].forEach((key) => {
    const active = state[`show${key}`];
    const btn = els[`show${key}Btn`];
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function applyPreset(name) {
  const preset = presets[name];
  state.preset = name;
  state.wave1 = { ...preset.wave1 };
  state.wave2 = { ...preset.wave2 };
  state.showEnvelope = preset.showEnvelope;
  syncControlsFromState();
  resetTime();
}

function markCustom() {
  state.preset = 'custom';
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });
}

function bindControl(prefix, waveKey, prop) {
  const range = document.getElementById(`${prefix}Range`);
  const number = document.getElementById(`${prefix}Number`);
  const update = (raw) => {
    const value = clamp(parseFloat(raw) || 0, Number(range.min), Number(range.max));
    state[waveKey][prop] = value;
    range.value = number.value = value;
    paintRange(range);
    markCustom();
    draw();
  };
  range.addEventListener('input', () => update(range.value));
  number.addEventListener('input', () => update(number.value));
}

bindPairs.forEach(([prefix, waveKey, prop]) => bindControl(prefix, waveKey, prop));
document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});
els.playBtn.addEventListener('click', () => setRunning(!state.running));
document.getElementById('stepForwardBtn').addEventListener('click', () => step(state.dt));
document.getElementById('stepBackBtn').addEventListener('click', () => step(-state.dt));
els.forwardBtn.addEventListener('click', () => { state.speed = 1; setRunning(true); });
els.backBtn.addEventListener('click', () => { state.speed = -1; setRunning(true); });
document.getElementById('resetBtn').addEventListener('click', resetTime);
document.getElementById('invertWave1Btn').addEventListener('click', () => invertWave('wave1'));
document.getElementById('invertWave2Btn').addEventListener('click', () => invertWave('wave2'));
['Wave1', 'Wave2', 'Sum', 'Envelope'].forEach((key) => {
  els[`show${key}Btn`].addEventListener('click', () => {
    state[`show${key}`] = !state[`show${key}`];
    updateEnvelopeControl();
    draw();
  });
});

let tapStart = null;
const activePointers = new Set();
canvas.addEventListener('pointerdown', (event) => {
  activePointers.add(event.pointerId);
  tapStart = activePointers.size === 1 && event.isPrimary && event.button === 0
    ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
});
canvas.addEventListener('pointermove', (event) => {
  if (tapStart && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > 8) tapStart = null;
});
canvas.addEventListener('pointercancel', (event) => { activePointers.delete(event.pointerId); tapStart = null; });
canvas.addEventListener('pointerup', (event) => {
  activePointers.delete(event.pointerId);
  const start = tapStart;
  tapStart = null;
  if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  setProbe(pxToX(px));
});
canvas.addEventListener('pointerleave', (event) => { activePointers.delete(event.pointerId); tapStart = null; });

let probeDrag = null;
els.probeHandle.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || probeDrag) return;
  tapStart = null;
  // Relative movement preserves the point when the edge of its touch target is grabbed.
  probeDrag = { id: event.pointerId, startX: event.clientX, x: pointX(state.selectedIndex), scale: (world.maxX - world.minX) / (view.width - 2 * world.paddingX) };
  els.probeHandle.setPointerCapture(event.pointerId);
  els.probeHandle.classList.add('dragging');
  event.preventDefault();
});
function moveProbe(event) {
  if (probeDrag && probeDrag.id === event.pointerId) setProbe(probeDrag.x + (event.clientX - probeDrag.startX) * probeDrag.scale);
}
function endProbeDrag(event) {
  if (!probeDrag || probeDrag.id !== event.pointerId) return;
  probeDrag = null;
  els.probeHandle.classList.remove('dragging');
  if (els.probeHandle.hasPointerCapture(event.pointerId)) els.probeHandle.releasePointerCapture(event.pointerId);
}
els.probeHandle.addEventListener('pointermove', moveProbe);
els.probeHandle.addEventListener('pointerup', (event) => { moveProbe(event); endProbeDrag(event); });
els.probeHandle.addEventListener('pointercancel', endProbeDrag);
els.probeHandle.addEventListener('lostpointercapture', endProbeDrag);
els.probeHandle.addEventListener('keydown', (event) => {
  const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
  if (direction !== undefined || event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const x = event.key === 'Home' ? world.minX : event.key === 'End' ? world.maxX : pointX(state.selectedIndex + direction);
    setProbe(x);
  }
});
document.addEventListener('visibilitychange', () => {
  state.lastTime = null;
  if (document.hidden) {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  } else requestTick();
});
window.addEventListener('resize', resizeCanvas);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(canvas);
syncControlsFromState();
resizeCanvas();
