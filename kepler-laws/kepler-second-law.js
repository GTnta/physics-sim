"use strict";
const physics = window.KeplerPhysics;
const controls = Object.fromEntries([
  "simulation", "canvasWrap", "orbitCanvas", "pointA", "pointB", "playback",
  "playPause", "playIcon", "playLabel", "resetTime", "timelineName", "timeSlider", "timeValue",
  "rateSlider", "rateValue", "velocityControl", "showVelocity", "vectorControls",
  "angleA", "angleB", "angleAValue", "angleBValue", "apsides", "reselectTwo",
  "eccentricity", "eccentricityValue", "makeCircle", "intervalControl", "interval", "intervalValue", "resetConditions",
  "loopReadout", "areasReadout", "vectorsReadout", "radiusValue", "speedValue", "areaElapsed",
  "areaAValue", "areaBValue", "areaCValue", "areaABar", "areaBBar", "areaCBar",
  "triangleAValue", "triangleBValue", "triangleABar", "triangleBBar", "pointAData", "pointBData",
  "areaFormula", "triangleFormula"
].map(id => [id, document.getElementById(id)]));
const tabs = [...document.querySelectorAll(".modes button")];
const ctx = controls.orbitCanvas.getContext("2d");
const colors = ["#2f7d8f", "#c45d3b", "#7951a8"];
const state = {
  mode: "loop", e: .7, interval: .08, rate: 1, phase: 0, progress: 0,
  angles: [0, 180], starts: [], sectors: [], orbit: physics.createOrbit(.7),
  playing: false, raf: null, last: null, readoutStamp: -Infinity, drag: null,
  view: null, staticLayer: document.createElement("canvas"), triangles: []
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
const screen = p => ({ x: state.view.ox + p.x * state.view.scale, y: state.view.oy - p.y * state.view.scale });
function pointPath(p, radius) { const q = screen(p); ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, physics.TAU); }
function strokeLine(a, b, color, width = 1.5, dash = []) {
  const from = screen(a), to = screen(b);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.setLineDash([]);
}
function arrow(from, to) {
  const a = screen(from), b = screen(to), dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < .05) return;
  const ux = dx / length, uy = dy / length, head = Math.min(11, length * .32);
  ctx.strokeStyle = "#27845c"; ctx.fillStyle = "#27845c"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - ux * head * .65, b.y - uy * head * .65); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - ux * head - uy * head * .46, b.y - uy * head + ux * head * .46); ctx.lineTo(b.x - ux * head + uy * head * .46, b.y - uy * head - ux * head * .46); ctx.closePath(); ctx.fill();
}
function planet(p, color, radius = 7) {
  pointPath(p, radius); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
}
function drawSun() {
  pointPath(state.orbit.focus, 10); ctx.fillStyle = "#e7af37"; ctx.fill(); ctx.strokeStyle = "#bd8423"; ctx.lineWidth = 1.5; ctx.stroke();
}
function buildStaticLayer() {
  const layer = state.staticLayer;
  layer.width = controls.orbitCanvas.width; layer.height = controls.orbitCanvas.height;
  const c = layer.getContext("2d"), view = state.view;
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); c.fillStyle = "#fff"; c.fillRect(0, 0, view.width, view.height);
  const center = screen({ x: 0, y: 0 });
  c.strokeStyle = "rgba(67,84,89,.45)"; c.lineWidth = 1.6; c.setLineDash([4, 6]);
  c.beginPath(); c.ellipse(center.x, center.y, state.orbit.a * view.scale, state.orbit.b * view.scale, 0, 0, physics.TAU); c.stroke(); c.setLineDash([]);
}
function resize() {
  const rect = controls.orbitCanvas.getBoundingClientRect();
  const width = rect.width, height = rect.height;
  const dpr = Math.min(devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2);
  let minX = -state.orbit.a, maxX = state.orbit.a, minY = -state.orbit.b, maxY = state.orbit.b;
  if (state.mode === "vectors" || (state.mode === "loop" && controls.showVelocity.checked)) {
    // Reserve every possible velocity tip, so changing a selected point never changes the scale.
    for (let i = 0; i < 360; i++) {
      const p = physics.atE(state.orbit, physics.TAU * i / 360);
      const x = p.x + p.vx * state.orbit.period / 30, y = p.y + p.vy * state.orbit.period / 30;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const padding = width < 600 ? 28 : 40;
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  state.view = { width, height, dpr, scale, ox: width / 2 - (minX + maxX) / 2 * scale, oy: height / 2 + (minY + maxY) / 2 * scale };
  controls.orbitCanvas.width = Math.round(width * dpr); controls.orbitCanvas.height = Math.round(height * dpr);
  buildStaticLayer(); draw(true);
}
function rebuildSectors() {
  // The first equal-time window straddles periapsis, even when its duration changes.
  state.starts = [-state.interval / 2, .35, .7];
  state.sectors = state.starts.map(start => physics.sector(state.orbit, start, state.interval));
}
function rebuildOrbit() {
  state.orbit = physics.createOrbit(state.e);
  rebuildSectors();
  resize();
}
function drawSector(sector, progress, color) {
  const current = physics.sample(state.orbit, sector.phase + sector.span * progress);
  const f = screen(state.orbit.focus), first = screen(sector.points[0]);
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(first.x, first.y);
  for (const p of sector.points) {
    if (p.E >= current.E) break;
    const q = screen(p); ctx.lineTo(q.x, q.y);
  }
  const end = screen(current); ctx.lineTo(end.x, end.y); ctx.closePath();
  ctx.globalAlpha = .22; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
  pointPath(sector.points[0], 5.5); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  planet(current, color);
  return { current, area: physics.areaBetweenE(state.orbit, sector.start, current.E) };
}
function drawTriangle(phase, color) {
  const triangle = physics.triangle(state.orbit, phase);
  const f = screen(state.orbit.focus), p = screen(triangle.p), tip = screen(triangle.tip);
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(p.x, p.y); ctx.lineTo(tip.x, tip.y); ctx.closePath();
  ctx.globalAlpha = .2; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  strokeLine(state.orbit.focus, triangle.p, color, 1.8);
  strokeLine(state.orbit.focus, triangle.tip, color, 1.2, [4, 4]);
  arrow(triangle.p, triangle.tip); planet(triangle.p, color, 7.5);
  return triangle;
}
function draw(force = false, timestamp = performance.now()) {
  if (!state.view) return;
  ctx.setTransform(state.view.dpr, 0, 0, state.view.dpr, 0, 0);
  ctx.drawImage(state.staticLayer, 0, 0, state.view.width, state.view.height);
  let samples;
  if (state.mode === "loop") {
    const p = physics.sample(state.orbit, state.phase);
    strokeLine(state.orbit.focus, p, "rgba(47,125,143,.65)", 1.6);
    if (controls.showVelocity.checked) arrow(p, physics.triangle(state.orbit, state.phase).tip);
    planet(p, colors[0], 8); samples = p;
  } else if (state.mode === "areas") {
    samples = state.sectors.map((sector, i) => drawSector(sector, state.progress, colors[i]));
  } else {
    samples = state.angles.map((angle, i) => drawTriangle(physics.phaseFromAngle(state.orbit, angle / 180 * Math.PI), colors[i]));
    state.triangles = samples;
    [controls.pointA, controls.pointB].forEach((handle, i) => {
      const p = screen(samples[i].p); handle.style.left = p.x + "px"; handle.style.top = p.y + "px";
    });
  }
  drawSun(); updateReadouts(samples, force, timestamp);
}
function updateReadouts(samples, force, timestamp) {
  if (!force && timestamp - state.readoutStamp < 1000 / 15) return;
  state.readoutStamp = timestamp;
  if (state.mode === "loop") {
    controls.timeSlider.value = state.phase;
    setText(controls.timeValue, state.phase.toFixed(2) + " T");
    setText(controls.radiusValue, (samples.radius / state.orbit.a).toFixed(2));
    setText(controls.speedValue, (samples.speed * state.orbit.period / state.orbit.a).toFixed(2));
  } else if (state.mode === "areas") {
    controls.timeSlider.value = state.progress;
    setText(controls.timeValue, (state.progress * state.interval).toFixed(3) + " T");
    setText(controls.areaElapsed, `経過 ${(state.progress * state.interval).toFixed(3)} T / ${state.interval.toFixed(3)} T`);
    samples.forEach((sample, i) => {
      const key = "ABC"[i];
      setText(controls[`area${key}Value`], Math.max(0, sample.area).toFixed(3) + " a²");
      controls[`area${key}Bar`].style.width = clamp(sample.area / (state.orbit.area * state.interval) * 100, 0, 100) + "%";
    });
  } else {
    samples.forEach((triangle, i) => {
      const key = "AB"[i];
      setText(controls[`triangle${key}Value`], triangle.area.toFixed(3) + " a²");
      controls[`triangle${key}Bar`].style.width = clamp(triangle.area / (state.orbit.area / 30) * 100, 0, 100) + "%";
      setText(controls[`point${key}Data`], `r / a = ${(triangle.p.radius / state.orbit.a).toFixed(2)}　v / (a / T) = ${(triangle.p.speed * state.orbit.period / state.orbit.a).toFixed(2)}`);
    });
  }
}
function updatePlayButton() {
  controls.playPause.classList.toggle("running", state.playing);
  controls.playIcon.classList.toggle("pause-icon", state.playing);
  setText(controls.playLabel, state.playing ? "一時停止" : state.mode === "areas" && state.progress >= 1 ? "もう一度" : "再生");
}
function pause() {
  state.playing = false;
  if (state.raf !== null) cancelAnimationFrame(state.raf);
  state.raf = null; state.last = null; updatePlayButton();
}
function tick(timestamp) {
  state.raf = null;
  if (!state.playing) return;
  const elapsed = state.last === null ? 0 : Math.min((timestamp - state.last) / 1000, .1);
  state.last = timestamp;
  if (state.mode === "loop") state.phase = physics.wrap(state.phase + elapsed * state.rate / 8);
  else state.progress = Math.min(1, state.progress + elapsed * state.rate / 3.2);
  if (state.mode === "areas" && state.progress >= 1) pause();
  draw(!state.playing, timestamp);
  if (state.playing) state.raf = requestAnimationFrame(tick);
}
function play() {
  if (state.mode === "vectors" || state.playing) return;
  if (state.mode === "areas" && state.progress >= 1) state.progress = 0;
  state.playing = true; state.last = null; updatePlayButton(); draw(true); state.raf = requestAnimationFrame(tick);
}
function setMode(mode) {
  pause(); state.mode = mode; document.body.dataset.mode = mode;
  tabs.forEach(tab => { const selected = tab.dataset.mode === mode; tab.setAttribute("aria-selected", selected); tab.tabIndex = selected ? 0 : -1; });
  controls.simulation.setAttribute("aria-labelledby", tabs.find(tab => tab.dataset.mode === mode).id);
  const vectors = mode === "vectors", areas = mode === "areas";
  controls.playback.hidden = vectors; controls.vectorControls.hidden = !vectors;
  controls.pointA.hidden = !vectors; controls.pointB.hidden = !vectors;
  controls.velocityControl.hidden = mode !== "loop";
  controls.intervalControl.hidden = !areas; controls.loopReadout.hidden = mode !== "loop";
  controls.areasReadout.hidden = !areas; controls.vectorsReadout.hidden = !vectors;
  controls.areaFormula.hidden = vectors; controls.triangleFormula.hidden = !vectors;
  setText(controls.timelineName, areas ? "同じ時間の経過" : "公転の位置");
  controls.timeSlider.setAttribute("aria-label", areas ? "比較する時間の経過" : "公転の位置");
  updatePlayButton(); resize();
}
function setEccentricity(raw, snap = false) {
  let e = clamp(Number(raw), 0, .85);
  if (snap) {
    const near = [0, .25, .5, .75].find(value => Math.abs(e - value) < .012);
    if (near !== undefined) e = near;
  }
  state.e = e; controls.eccentricity.value = e;
  setText(controls.eccentricityValue, e.toFixed(2));
  setText(controls.apsides, e === 0 ? "左右の点" : "最近点・最遠点");
  rebuildOrbit();
}
function setAngle(index, value, snap = false) {
  let angle = clamp(Number(value), 0, 360);
  if (snap) {
    const nearest = Math.round(angle / 90) * 90;
    if (Math.abs(nearest - angle) < 4) angle = nearest;
  }
  state.angles[index] = angle;
  const key = "AB"[index]; controls[`angle${key}`].value = angle;
  setText(controls[`angle${key}Value`], Math.round(angle) + "°");
  controls[`point${key}`].setAttribute("aria-valuenow", String(Math.round(angle)));
  draw(true);
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
  tab.addEventListener("keydown", event => {
    let target;
    if (event.key === "ArrowRight") target = (i + 1) % tabs.length;
    if (event.key === "ArrowLeft") target = (i + tabs.length - 1) % tabs.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = tabs.length - 1;
    if (target !== undefined) { event.preventDefault(); tabs[target].focus(); setMode(tabs[target].dataset.mode); }
  });
});
controls.playPause.addEventListener("click", () => { if (state.playing) { pause(); draw(true); } else play(); });
controls.resetTime.addEventListener("click", () => { pause(); if (state.mode === "loop") state.phase = 0; else state.progress = 0; draw(true); });
controls.timeSlider.addEventListener("input", () => { pause(); if (state.mode === "loop") state.phase = Number(controls.timeSlider.value); else state.progress = Number(controls.timeSlider.value); updatePlayButton(); draw(true); });
controls.rateSlider.addEventListener("input", () => { state.rate = Number(controls.rateSlider.value); setText(controls.rateValue, state.rate.toFixed(2) + "×"); });
controls.showVelocity.addEventListener("change", resize);
controls.eccentricity.addEventListener("input", () => setEccentricity(controls.eccentricity.value, true));
controls.eccentricity.addEventListener("keydown", event => {
  const changes = { ArrowLeft: -.01, ArrowDown: -.01, ArrowRight: .01, ArrowUp: .01, PageDown: -.05, PageUp: .05 };
  if (event.key in changes || event.key === "Home" || event.key === "End") {
    event.preventDefault(); setEccentricity(event.key === "Home" ? 0 : event.key === "End" ? .85 : state.e + changes[event.key]);
  }
});
controls.makeCircle.addEventListener("click", () => setEccentricity(0));
controls.interval.addEventListener("input", () => { state.interval = Number(controls.interval.value); setText(controls.intervalValue, state.interval.toFixed(3)); rebuildSectors(); draw(true); });
controls.apsides.addEventListener("click", () => { setAngle(0, 0); setAngle(1, 180); });
controls.reselectTwo.addEventListener("click", () => { setAngle(0, 15 + Math.random() * 145); setAngle(1, 195 + Math.random() * 145); });
controls.resetConditions.addEventListener("click", () => {
  pause(); state.phase = 0; state.progress = 0; state.interval = .08; state.rate = 1;
  controls.interval.value = .08; controls.rateSlider.value = 1;
  setText(controls.intervalValue, "0.080"); setText(controls.rateValue, "1.00×"); controls.showVelocity.checked = false;
  setEccentricity(.7); setAngle(0, 0); setAngle(1, 180); updatePlayButton();
});
[controls.angleA, controls.angleB].forEach((slider, index) => slider.addEventListener("input", () => setAngle(index, slider.value)));
[controls.pointA, controls.pointB].forEach((handle, index) => {
  handle.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault(); handle.setPointerCapture(event.pointerId); handle.classList.add("dragging");
    state.drag = { id: event.pointerId, index, x: event.clientX, y: event.clientY, view: { ...state.view }, initial: physics.sample(state.orbit, physics.phaseFromAngle(state.orbit, state.angles[index] / 180 * Math.PI)) };
  });
  handle.addEventListener("pointermove", event => {
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId || drag.index !== index) return;
    const x = drag.initial.x + (event.clientX - drag.x) / drag.view.scale;
    const y = drag.initial.y - (event.clientY - drag.y) / drag.view.scale;
    if (Math.hypot(x, y) < .02) return;
    const E = Math.atan2(-y / state.orbit.b, -x / state.orbit.a);
    const phase = physics.phaseFromE(state.orbit, E);
    setAngle(index, physics.angleFromPhase(state.orbit, phase) / Math.PI * 180, true);
  });
  const release = event => {
    if (state.drag?.id !== event.pointerId || state.drag.index !== index) return;
    state.drag = null; handle.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  handle.addEventListener("pointerup", release); handle.addEventListener("pointercancel", release); handle.addEventListener("lostpointercapture", release);
  handle.addEventListener("keydown", event => {
    let value;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") value = Math.floor(state.angles[index] + 1e-8) + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") value = Math.ceil(state.angles[index] - 1e-8) - 1;
    if (event.key === "Home") value = 0;
    if (event.key === "End") value = 360;
    if (value !== undefined) { event.preventDefault(); setAngle(index, value); }
  });
});
document.addEventListener("visibilitychange", () => { state.last = null; });
rebuildSectors();
new ResizeObserver(resize).observe(controls.orbitCanvas);
resize();
