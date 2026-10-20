(function (root, factory) {
  const solver = typeof module === "object" && module.exports ? require("./vendor/astronomia-kepler-4.2.0.js") : root.AstronomiaKepler;
  const api = factory(solver);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KeplerPhysics = api;
})(typeof globalThis === "object" ? globalThis : this, function (solver) {
  "use strict";
  const TAU = 2 * Math.PI;
  const wrap = value => ((value % 1) + 1) % 1;
  function createOrbit(e = .7, a = 1, period = 1) {
    if (!(e >= 0 && e < 1 && a > 0 && period > 0)) throw new RangeError("Invalid elliptic orbit");
    const b = a * Math.sqrt(1 - e * e);
    return { e, a, b, period, n: TAU / period, focus: { x: -a * e, y: 0 }, area: Math.PI * a * b };
  }
  function phaseFromE(orbit, E) { return (E - orbit.e * Math.sin(E)) / TAU; }
  function eccentricAnomaly(orbit, phase) {
    const cycle = Math.floor(phase);
    const fraction = phase - cycle;
    let E = solver.kepler3(orbit.e, fraction * TAU);
    if (E < 0) E += TAU;
    return E + cycle * TAU;
  }
  function atE(orbit, E) {
    const c = Math.cos(E), s = Math.sin(E);
    const dEdt = orbit.n / (1 - orbit.e * c);
    const x = -orbit.a * c, y = -orbit.b * s;
    const vx = orbit.a * s * dEdt, vy = -orbit.b * c * dEdt;
    const rx = x - orbit.focus.x;
    return { x, y, vx, vy, rx, ry: y, radius: Math.hypot(rx, y), speed: Math.hypot(vx, vy), E, phase: phaseFromE(orbit, E) };
  }
  function sample(orbit, phase) { return atE(orbit, eccentricAnomaly(orbit, phase)); }
  function phaseFromAngle(orbit, angle) {
    const E = Math.atan2(Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(angle), orbit.e + Math.cos(angle));
    return wrap(phaseFromE(orbit, E));
  }
  function angleFromPhase(orbit, phase) {
    const p = sample(orbit, phase);
    return wrap(Math.atan2(-p.ry, -p.rx) / TAU) * TAU;
  }
  function sweptArea(orbit, phase, span) {
    const start = eccentricAnomaly(orbit, phase), end = eccentricAnomaly(orbit, phase + span);
    return areaBetweenE(orbit, start, end);
  }
  function areaBetweenE(orbit, start, end) { return .5 * orbit.a * orbit.b * (end - start - orbit.e * (Math.sin(end) - Math.sin(start))); }
  function sector(orbit, phase, span) {
    const start = eccentricAnomaly(orbit, phase), end = eccentricAnomaly(orbit, phase + span);
    const count = Math.max(24, Math.ceil(Math.abs(end - start) * 100));
    const points = Array.from({ length: count + 1 }, (_, i) => atE(orbit, start + (end - start) * i / count));
    return { start, end, phase, span, points, area: sweptArea(orbit, phase, span) };
  }
  function triangle(orbit, phase, time = orbit.period / 30) {
    const p = sample(orbit, phase);
    const tip = { x: p.x + p.vx * time, y: p.y + p.vy * time };
    const area = .5 * Math.abs(p.rx * (tip.y - p.y) - p.ry * (tip.x - p.x));
    return { p, tip, area, time };
  }
  return { TAU, wrap, createOrbit, eccentricAnomaly, phaseFromE, phaseFromAngle, angleFromPhase, atE, sample, sweptArea, areaBetweenE, sector, triangle };
});
