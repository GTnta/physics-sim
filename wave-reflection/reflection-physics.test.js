"use strict";
const assert = require("node:assert/strict");
const physics = require("./reflection-physics.js");
let checks = 0;
function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
  checks++;
}

for (const mode of ["pulse", "continuous"]) {
  for (const amplitude of [.25, 1, 1.5]) {
    for (const speed of [1, 2, 4]) {
      for (const polarity of [-1, 1]) {
        for (const size of (mode === "pulse" ? [1, 2, 3, 4] : [2, 3, 6])) {
          const config = { ...physics.defaults, mode, amplitude, speed, polarity, width: size, wavelength: size };
          const end = physics.duration(config), epsilon = 1e-5;
          for (let i = 0; i <= 80; i++) {
            const time = end * i / 80;
            const fixed = physics.sample(physics.LENGTH, time, "fixed", config);
            const free = physics.sample(physics.LENGTH, time, "free", config);
            near(fixed.total, 0);
            near(fixed.reflected, -fixed.incident);
            near(free.reflected, free.incident);
            near(free.total, 2 * free.incident);
            const slope = (physics.sample(physics.LENGTH + epsilon, time, "free", config).total - physics.sample(physics.LENGTH - epsilon, time, "free", config).total) / (2 * epsilon);
            near(slope, 0, 1e-7);
            for (const boundary of ["fixed", "free"]) {
              const sample = physics.sample(7, time, boundary, config);
              near(sample.total, sample.incident + sample.reflected);
              assert.ok(Math.abs(sample.total) <= 2 * amplitude + 1e-8);
            }
          }
          if (mode === "pulse") {
            near(physics.sample(physics.START, 0, "fixed", config).total, polarity * amplitude);
            const time = (physics.LENGTH - physics.START + size) / speed;
            const center = 2 * physics.LENGTH - physics.START - speed * time;
            near(physics.sample(center, time, "fixed", config).reflected, -polarity * amplitude);
            near(physics.sample(center, time, "free", config).reflected, polarity * amplitude);
            for (const boundary of ["fixed", "free"]) {
              for (let x = 0; x <= physics.LENGTH; x += .25) near(physics.sample(x, end, boundary, config).total, 0);
            }
          } else {
            for (let x = 0; x <= physics.LENGTH; x += .5) {
              near(physics.sample(x, Math.max(0, (2 * physics.LENGTH - x) / speed - .001), "free", config).reflected, 0);
            }
            // Once both fronts have passed, fixed-end nodes are at multiples of half a wavelength from the end.
            const time = 2 * physics.LENGTH / speed + 2 * size / speed;
            for (let distance = 0; distance <= physics.LENGTH; distance += size / 2) {
              near(physics.sample(physics.LENGTH - distance, time, "fixed", config).total, 0, 1e-7);
            }
          }
        }
      }
    }
  }
}

function energy(time, boundary, config) {
  const n = 4000, dx = physics.LENGTH / n, h = 1e-5;
  let result = 0;
  for (let i = 0; i <= n; i++) {
    const x = i * dx;
    const dy = (physics.sample(x + h, time, boundary, config).total - physics.sample(x - h, time, boundary, config).total) / (2 * h);
    const dt = (physics.sample(x, time + h, boundary, config).total - physics.sample(x, time - h, boundary, config).total) / (2 * h);
    result += (dy * dy + dt * dt / config.speed ** 2) * dx * (i === 0 || i === n ? .5 : 1);
  }
  return result;
}
for (const boundary of ["fixed", "free"]) {
  const config = physics.defaults, baseline = energy(0, boundary, config);
  for (const offset of [-.5, 0, .5]) near(energy(physics.arrival(config) + offset, boundary, config) / baseline, 1, .001);
}
console.log(`Reflection physics: ${checks} checks passed (boundary conditions, causality, inversion, nodes, energy).`);
