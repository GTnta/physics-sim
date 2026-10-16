const assert = require('node:assert/strict');
const physics = require('../monkey-hunting/monkey-hunting-physics.js');
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const fixture = { distance: 12, height: 10.5, launchHeight: 1.5, speed: 15, gravity: 10 };
const direct = physics.createPlan(fixture);
assert.equal(direct.outcome, 'meet');
near(direct.duration, 1);
const end = physics.sample(direct, 1);
near(end.ball.x, 12); near(end.ball.y, 5.5); near(end.monkey.y, 5.5); near(end.separation, 0);

for (const gravity of [0, 1.6, 9.8, 20]) {
  for (const speed of [5, 10, 14, 18, 30]) {
    for (const distance of [6, 18, 36]) {
      const plan = physics.createPlan({ gravity, speed, distance });
      assert.ok(Number.isFinite(plan.duration) && plan.duration > 0);
      for (let i = 0; i <= 40; i += 1) {
        const s = physics.sample(plan, plan.duration * i / 40);
        near(s.ballDrop, s.monkeyDrop);
        assert.ok(s.ball.y >= -1e-8 && s.monkey.y >= -1e-8);
        // The cross product with the initial line of sight is zero in shared free fall.
        near(s.relative.x * (plan.params.height - plan.params.launchHeight) - s.relative.y * distance, 0, 1e-7);
      }
      if (plan.meets) near(physics.sample(plan, plan.duration).separation, 0);
      else assert.ok(plan.duration <= plan.firstGroundTime + 1e-8);
    }
  }
}
const threshold = 15 * Math.sqrt(10 / 21);
assert.equal(physics.createPlan({ ...fixture, speed: threshold }).outcome, 'ground-meet');
assert.equal(physics.createPlan({ ...fixture, speed: threshold + 1e-5 }).outcome, 'meet');
assert.equal(physics.createPlan({ ...fixture, speed: threshold - 1e-5 }).meets, false);

const delayed = physics.createPlan({ ...fixture, delay: .25 });
near(delayed.crossingGap, -2.1875);
assert.equal(delayed.meets, false);
for (const t of [.25 - 1e-7, .25, .25 + 1e-7]) {
  const s = physics.sample(delayed, t);
  assert.ok(Math.abs(s.monkey.y - 10.5) < 1e-9);
  assert.ok(Math.abs(s.monkeyVelocity.y) < 1e-5);
}
const noGravity = physics.createPlan({ ...fixture, gravity: 0, delay: 1 });
assert.equal(noGravity.meets, true);
near(noGravity.duration, 1);
const aimedAway = physics.createPlan({ ...fixture, offset: 8 });
assert.equal(aimedAway.meets, false);
assert.ok(Math.abs(physics.sample(aimedAway, .5).bearing) > .01);

for (const distance of [6, 36]) for (const height of [4, 24]) {
  for (const speed of [5, 30]) for (const offset of [-15, 15]) {
    for (const gravity of [0, 20]) for (const delay of [0, 1]) {
      const plan = physics.createPlan({ distance, height, speed, offset, gravity, delay });
      assert.ok(Number.isFinite(plan.duration) && plan.duration > 0);
      const s = physics.sample(plan, plan.duration);
      assert.ok([s.ball.x,s.ball.y,s.monkey.y,s.separation].every(Number.isFinite));
      assert.ok(s.ball.y >= -1e-8 && s.monkey.y >= -1e-8);
    }
  }
}
const backwards = physics.createPlan({distance:6,height:24,offset:15,gravity:0});
assert.ok(backwards.vx < 0);
assert.equal(backwards.meets, false);
assert.equal(backwards.outcome, 'no-crossing');

for (const [key, params] of Object.entries(physics.presets)) {
  const plan = physics.createPlan(params);
  const endpoint = physics.sample(plan, plan.duration);
  near(physics.sample(plan, plan.duration + 100).separation, endpoint.separation);
  near(physics.sample(plan, -.5).time, 0);
  console.log(`${key}: ${plan.outcome}, t=${plan.duration.toFixed(4)} s`);
}
assert.equal(physics.createPlan(physics.presets.direct).meets, true);
assert.equal(physics.createPlan(physics.presets.slower).meets, true);
assert.equal(physics.createPlan(physics.presets.slowest).meets, false);
assert.equal(physics.presets.hanging, undefined);
console.log('Analytic flight, relative motion, release continuity, presets and ground limits passed.');
