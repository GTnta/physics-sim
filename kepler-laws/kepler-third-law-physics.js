(function (root, factory) {
  const kepler = typeof module === "object" && module.exports ? require("./kepler-physics.js") : root.KeplerPhysics;
  const api = factory(kepler);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KeplerThirdLaw = api;
})(typeof globalThis === "object" ? globalThis : this, function (kepler) {
  "use strict";
  function period(a) {
    if (!Number.isFinite(a) || a <= 0) throw new RangeError("The semimajor axis must be positive and finite.");
    return a ** 1.5;
  }
  function createOrbit(a, e) {
    if (!Number.isFinite(e)) throw new RangeError("The eccentricity must be finite.");
    return kepler.createOrbit(e, a, period(a));
  }
  function clock(time, orbitalPeriod) {
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(orbitalPeriod) || orbitalPeriod <= 0) {
      throw new RangeError("The clock needs nonnegative time and a positive period.");
    }
    let cycles = time / orbitalPeriod;
    const nearest = Math.round(cycles);
    // Exact period markers must not be reported as the previous lap by roundoff.
    if (Math.abs(cycles - nearest) <= 8 * Number.EPSILON * Math.max(1, cycles)) cycles = nearest;
    const laps = Math.floor(cycles);
    return { laps, phase: cycles - laps, angle: (cycles - laps) * kepler.TAU - Math.PI / 2 };
  }
  function sample(orbit, time) {
    const reading = clock(time, orbit.period);
    const position = kepler.sample(orbit, reading.phase);
    // Each ellipse has a different center, but both share the same focus at (0, 0).
    return { x: position.rx, y: position.ry, speed: position.speed, clock: reading };
  }
  return { period, createOrbit, clock, sample };
});
