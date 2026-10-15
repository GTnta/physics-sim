(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MonkeyPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({ distance: 18, height: 12, launchHeight: 1.5, speed: 18, offset: 0, gravity: 9.8, delay: 0, drops: true });
  const presets = Object.freeze({
    direct: { ...defaults },
    slower: { ...defaults, speed: 14 },
    slowest: { ...defaults, speed: 10 },
    higher: { ...defaults, offset: 8 },
    delayed: { ...defaults, delay: .35 },
    hanging: { ...defaults, drops: false }
  });

  function finite(value, fallback, min, max) {
    return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  }

  function sample(plan, time) {
    const p = plan.params;
    const t = Math.min(plan.duration, Math.max(0, Number(time) || 0));
    const fallTime = p.drops ? Math.max(0, t - p.delay) : 0;
    const ball = { x: plan.vx * t, y: p.launchHeight + plan.vy * t - .5 * p.gravity * t * t };
    const monkey = { x: p.distance, y: p.height - .5 * p.gravity * fallTime * fallTime };
    const relative = { x: monkey.x - ball.x, y: monkey.y - ball.y };
    return {
      time: t, ball, monkey, relative,
      separation: Math.hypot(relative.x, relative.y),
      ballVelocity: { x: plan.vx, y: plan.vy - p.gravity * t },
      monkeyVelocity: { x: 0, y: -p.gravity * fallTime },
      ballDrop: .5 * p.gravity * t * t,
      monkeyDrop: .5 * p.gravity * fallTime * fallTime,
      released: p.drops && t >= p.delay,
      bearing: Math.atan2(relative.y, relative.x) - plan.sightAngle,
      finished: t >= plan.duration - 1e-8
    };
  }

  function createPlan(input = {}) {
    const p = {
      distance: finite(input.distance, defaults.distance, 6, 36),
      height: finite(input.height, defaults.height, 4, 24),
      launchHeight: finite(input.launchHeight, defaults.launchHeight, .5, 3),
      speed: finite(input.speed, defaults.speed, 5, 30),
      offset: finite(input.offset, defaults.offset, -15, 15),
      gravity: finite(input.gravity, defaults.gravity, 0, 20),
      delay: finite(input.delay, defaults.delay, 0, 1),
      drops: input.drops === undefined ? defaults.drops : Boolean(input.drops)
    };
    const sightAngle = Math.atan2(p.height - p.launchHeight, p.distance);
    const launchAngle = sightAngle + p.offset * Math.PI / 180;
    const vx = p.speed * Math.cos(launchAngle);
    const vy = p.speed * Math.sin(launchAngle);
    const crossingTime = vx > 1e-10 ? p.distance / vx : Infinity;
    const ballGroundTime = p.gravity > 0
      ? (vy + Math.hypot(vy, Math.sqrt(2 * p.gravity * p.launchHeight))) / p.gravity
      : vy < 0 ? -p.launchHeight / vy : Infinity;
    const monkeyGroundTime = p.drops && p.gravity > 0 ? p.delay + Math.sqrt(2 * p.height / p.gravity) : Infinity;
    const firstGroundTime = Math.min(ballGroundTime, monkeyGroundTime);
    const crossFall = p.drops ? Math.max(0, crossingTime - p.delay) : 0;
    const crossingGap = Number.isFinite(crossingTime)
      ? p.launchHeight + vy * crossingTime - .5 * p.gravity * crossingTime ** 2
        - (p.height - .5 * p.gravity * crossFall ** 2) : null;
    const atGround = Math.abs(crossingTime - firstGroundTime) < 1e-8;
    const meets = Number.isFinite(crossingTime) && crossingTime <= firstGroundTime + 1e-8 && Math.abs(crossingGap) < 1e-8;
    // A near-vertical miss with no gravity has no finite ground event.
    const observationEnd = Math.min(crossingTime + .65, Math.max(3, 2 * Math.hypot(p.distance, p.height - p.launchHeight) / p.speed));
    const duration = meets ? crossingTime : Math.min(firstGroundTime, observationEnd);
    const outcome = meets ? (atGround ? 'ground-meet' : 'meet')
      : firstGroundTime <= observationEnd ? (ballGroundTime <= monkeyGroundTime ? 'ball-ground' : 'monkey-ground')
        : crossingTime <= duration ? 'miss' : 'no-crossing';
    return {
      params: p, sightAngle, launchAngle, vx, vy, crossingTime, crossingGap,
      ballGroundTime, monkeyGroundTime, firstGroundTime, meets, outcome,
      duration, equalAcceleration: p.gravity === 0 || (p.drops && p.delay === 0),
      minimumSpeed: Math.hypot(p.distance, p.height - p.launchHeight) * Math.sqrt(p.gravity / (2 * p.height))
    };
  }

  return Object.freeze({ defaults, presets, createPlan, sample });
});
