"use strict";
const assert = require("node:assert/strict");
const physics = require("./kepler-physics.js");
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
for (const e of [0, .1, .5, .7, .85, .95]) {
  const orbit = physics.createOrbit(e, 1.7, 2.4);
  const expectedRate = orbit.area / orbit.period;
  for (const phase of [-.4, 0, .00001, .13, .5, .83, .999999, 1, 1.3]) {
    const p = physics.sample(orbit, phase);
    near(p.E - e * Math.sin(p.E), physics.TAU * phase);
    near(p.x * p.x / orbit.a ** 2 + p.y * p.y / orbit.b ** 2, 1);
    near(.5 * (p.rx * p.vy - p.ry * p.vx), expectedRate);
    const mu = orbit.n ** 2 * orbit.a ** 3;
    near(p.speed ** 2 / 2 - mu / p.radius, -mu / (2 * orbit.a), 1e-8);
    const dt = 1e-7;
    const before = physics.sample(orbit, phase - dt / orbit.period), after = physics.sample(orbit, phase + dt / orbit.period);
    near((after.x - before.x) / (2 * dt), p.vx, 5e-6);
    near((after.y - before.y) / (2 * dt), p.vy, 5e-6);
    for (const span of [.02, .08, .15, .3]) {
      near(physics.sweptArea(orbit, phase, span), orbit.area * span);
      const sector = physics.sector(orbit, phase, span);
      let polygonArea = 0;
      for (let i = 1; i < sector.points.length; i++) {
        const a = sector.points[i - 1], b = sector.points[i];
        polygonArea += ((a.x - orbit.focus.x) * b.y - a.y * (b.x - orbit.focus.x)) / 2;
      }
      assert.ok(Math.abs(polygonArea - sector.area) / sector.area < .0004, `curved-sector geometry e=${e}`);
    }
    const triangle = physics.triangle(orbit, phase);
    near(triangle.area, expectedRate * triangle.time);
  }
  for (const angle of [0, .2, Math.PI / 2, Math.PI, 5.7, physics.TAU]) {
    const phase = physics.phaseFromAngle(orbit, angle);
    const recovered = physics.angleFromPhase(orbit, phase);
    near(Math.cos(angle), Math.cos(recovered)); near(Math.sin(angle), Math.sin(recovered));
  }
  for (const span of [.02, .08, .15]) {
    const crossing = physics.sector(orbit, -span / 2, span);
    assert.ok(crossing.start < 0 && crossing.end > 0);
    near(crossing.start, -crossing.end);
    near(crossing.area, orbit.area * span);
    const midpoint = physics.sample(orbit, crossing.phase + crossing.span / 2);
    near(midpoint.x, -orbit.a); near(midpoint.y, 0);
  }
  const peri = physics.sample(orbit, 0), apo = physics.sample(orbit, .5);
  near(peri.radius, orbit.a * (1 - e)); near(apo.radius, orbit.a * (1 + e));
  near(peri.speed / apo.speed, (1 + e) / (1 - e));
  console.log(`PASS e=${e}: Kepler residual, ellipse, energy, velocities, equal areas, triangles, wrap`);
}
const circle = physics.createOrbit(0);
near(physics.sample(circle, .13).speed, physics.sample(circle, .71).speed);
near(physics.sample(circle, .13).radius, physics.sample(circle, .71).radius);
assert.throws(() => physics.createOrbit(1), RangeError);
console.log("Kepler second-law physics passed, including the circular limit.");
