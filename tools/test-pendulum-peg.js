const assert = require("node:assert/strict");
const physics = require("../circular-motion/pendulum-peg-physics.js");

for (const ratio of [.2, .3, .4, .400001, .5, .55, .8, .999, 1]) {
  const plan = physics.createPlan({ ratio });
  assert.ok(Number.isFinite(plan.duration) && plan.duration > 0);
  assert.equal(plan.passes, ratio <= .4);
  const initial = physics.sample(plan, 0);
  assert.ok(Math.abs(initial.position.x + 1) < 1e-10);
  assert.ok(Math.hypot(initial.velocity.x, initial.velocity.y) < 1e-6);
  const before = physics.sample(plan, plan.approach.duration - 1e-8);
  const entry = physics.sample(plan, plan.approach.duration);
  assert.ok(Math.abs(before.tension - 3) < 1e-6);
  assert.ok(Math.abs(entry.tension - (1 + 2 / ratio)) < 1e-9);
  assert.ok(Math.hypot(before.position.x - entry.position.x, before.position.y - entry.position.y) < 1e-6);
  assert.ok(Math.hypot(before.velocity.x - entry.velocity.x, before.velocity.y - entry.velocity.y) < 1e-6);
  for (let i = 0; i <= 300; i += 1) {
    const sample = physics.sample(plan, plan.duration * i / 300);
    const speedSquared = sample.velocity.x ** 2 + sample.velocity.y ** 2;
    const energy = speedSquared / (2 * plan.gravity) + sample.position.y;
    assert.ok(Math.abs(energy - 1) < 1e-10, `energy at r/l=${ratio}`);
    assert.ok(sample.tension >= 0 && Number.isFinite(sample.tension));
    if (sample.taut) {
      assert.ok(Math.abs(Math.hypot(sample.position.x - sample.pivot.x, sample.position.y - sample.pivot.y) - sample.radius) < 1e-10);
    } else {
      assert.ok(Math.hypot(sample.position.x - plan.peg.x, sample.position.y - plan.peg.y) <= plan.r + 1e-10);
      assert.equal(sample.tension, 0);
    }
  }
  if (plan.passes) {
    const top = physics.sample(plan, plan.events.find(e => e.key === "top").time);
    assert.ok(Math.abs(top.tension - (2 / ratio - 5)) < 2e-5);
    assert.ok(Math.abs(top.position.y - 2 * ratio) < 1e-6);
    const finish = physics.sample(plan, plan.duration);
    assert.ok(Math.hypot(finish.position.x, finish.position.y) < 1e-10);
  } else if (plan.flight) {
    const detach = physics.sample(plan, plan.circleEnd);
    assert.ok(detach.tension < 1e-9);
    const finish = physics.sample(plan, plan.duration);
    assert.ok(Math.abs(Math.hypot(finish.position.x - plan.peg.x, finish.position.y - plan.peg.y) - plan.r) < 1e-9);
  } else {
    const finish = physics.sample(plan, plan.duration);
    assert.ok(Math.hypot(finish.velocity.x, finish.velocity.y) < 1e-6);
  }
  console.log(`PASS r/l=${ratio}: ${plan.outcome}, duration=${plan.duration.toFixed(6)} s`);
}

// Release from a horizontal string is a quarter of the exact large-amplitude pendulum period.
assert.ok(Math.abs(physics.createPlan().approach.duration - 1.8540746773013719 / Math.sqrt(9.8)) < 1e-9);
const defaultPlan = physics.createPlan();
assert.equal(defaultPlan.ratio, .5);
assert.equal(2 * defaultPlan.r, defaultPlan.origin.y);
assert.equal(defaultPlan.outcome, "slack");
assert.ok(defaultPlan.circle.endAngle < Math.PI);
const release = defaultPlan.flight.launch;
const highestFlightPoint = release.position.y + release.velocity.y ** 2 / (2 * defaultPlan.gravity);
assert.ok(Math.abs(highestFlightPoint - 25 / 27) < 1e-10);
console.log("Pendulum/peg energy, tension, transitions, and limiting cases passed.");
