"use strict";
const assert = require("node:assert/strict");
const physics = require("./kepler-third-law-physics.js");
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
let cases = 0;
for (const a of [.5, .55, 1, 1.35, 2, 2.95, 3]) {
  for (const e of [0, .1, .5, .85]) {
    const orbit = physics.createOrbit(a, e);
    near(orbit.period ** 2 / orbit.a ** 3, 1);
    near(orbit.n ** 2 * orbit.a ** 3, 4 * Math.PI ** 2);
    for (const phase of [0, .001, .13, .25, .5, .83, .999999, 1, 2.4, 100.25]) {
      const p = physics.sample(orbit, phase * orbit.period);
      near((p.x - a * e) ** 2 / a ** 2 + p.y ** 2 / orbit.b ** 2, 1);
      near(p.clock.phase, phase % 1, 1e-10);
      assert.equal(p.clock.laps, Math.floor(phase));
      const again = physics.sample(orbit, (phase + 1) * orbit.period);
      near(p.x, again.x); near(p.y, again.y);
      const radius = Math.hypot(p.x, p.y);
      near(p.speed ** 2, 4 * Math.PI ** 2 * (2 / radius - 1 / a), 1e-7);
      cases++;
    }
    const peri = physics.sample(orbit, 0), apo = physics.sample(orbit, orbit.period / 2);
    near(peri.x, -a * (1 - e)); near(apo.x, a * (1 + e));
    near(physics.sample(orbit, orbit.period).clock.angle, -Math.PI / 2);
    near(physics.sample(orbit, orbit.period / 4).clock.angle, 0);
    const before = physics.sample(orbit, orbit.period * (1 - 1e-7));
    assert.equal(before.clock.laps, 0);
    const after = physics.sample(orbit, orbit.period * (1 + 1e-7));
    assert.equal(after.clock.laps, 1);
    for (const laps of [1, 3, 17, 10000]) {
      const p = physics.sample(orbit, orbit.period * laps);
      assert.equal(p.clock.laps, laps); near(p.clock.phase, 0);
    }
  }
}
const first = physics.createOrbit(1, .5), second = physics.createOrbit(2, .5);
near(second.period / first.period, 2 * Math.sqrt(2));
assert.equal(physics.sample(first, second.period).clock.laps, 2);
assert.equal(physics.sample(second, second.period).clock.laps, 1);
near(physics.sample(first, .25).clock.angle, physics.sample(physics.createOrbit(1, .85), .25).clock.angle);
for (const a of [0, -1, NaN, Infinity]) assert.throws(() => physics.period(a), RangeError);
for (const e of [-.1, 1, NaN, Infinity]) assert.throws(() => physics.createOrbit(1, e), RangeError);
for (const t of [-1, NaN, Infinity]) assert.throws(() => physics.clock(t, 1), RangeError);
console.log(`PASS ${cases} shared-focus, period, energy, closure and clock cases; circular limit, lap boundaries, shared mass, independent periods.`);
