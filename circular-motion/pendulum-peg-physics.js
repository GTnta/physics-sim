(function (root) {
  "use strict";

  const TWO_PI = 2 * Math.PI;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function arcState(arc, angle, gravity) {
    const position = {
      x: arc.pivot.x + arc.radius * Math.sin(angle),
      y: arc.pivot.y - arc.radius * Math.cos(angle)
    };
    const speed = Math.sqrt(Math.max(0, 2 * gravity * (arc.energyHeight - position.y)));
    const direction = Math.sign(arc.endAngle - arc.startAngle);
    return {
      position,
      velocity: { x: direction * speed * Math.cos(angle), y: direction * speed * Math.sin(angle) },
      tension: Math.max(0, speed * speed / (gravity * arc.radius) + Math.cos(angle)),
      tensionDirection: { x: -Math.sin(angle), y: Math.cos(angle) },
      angle,
      taut: true,
      pivot: arc.pivot,
      radius: arc.radius
    };
  }

  // The sine-squared substitution removes the integrable singularity at a turning point.
  function makeArc(options, gravity) {
    const arc = { ...options, map: [{ time: 0, angle: options.startAngle }] };
    const span = arc.endAngle - arc.startAngle;
    const angleAt = (u) => arc.startAngle + span * Math.sin(Math.PI * u / 2) ** 2;
    const integrand = (u) => {
      const angle = angleAt(u);
      const y = arc.pivot.y - arc.radius * Math.cos(angle);
      const speedSquared = 2 * gravity * (arc.energyHeight - y);
      if (speedSquared < 1e-12 && (u === 0 || u === 1)) {
        return Math.PI * Math.sqrt(arc.radius * Math.abs(span) / (2 * gravity * Math.abs(Math.sin(angle))));
      }
      const derivative = Math.abs(span) * Math.PI * Math.sin(Math.PI * u) / 2;
      return arc.radius * derivative / Math.sqrt(Math.max(speedSquared, 1e-16));
    };
    const count = Math.max(600, Math.ceil(Math.abs(span) * 220));
    let time = 0;
    for (let i = 1; i <= count; i += 1) {
      const a = (i - 1) / count;
      const b = i / count;
      time += (b - a) * (integrand(a) + 4 * integrand((a + b) / 2) + integrand(b)) / 6;
      arc.map.push({ time, angle: angleAt(b) });
    }
    arc.duration = time;
    return arc;
  }

  function angleAtTime(arc, time) {
    const target = clamp(time, 0, arc.duration);
    let low = 0;
    let high = arc.map.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (arc.map[mid].time <= target) low = mid;
      else high = mid;
    }
    const a = arc.map[low];
    const b = arc.map[high];
    const ratio = (target - a.time) / (b.time - a.time);
    return a.angle + (b.angle - a.angle) * ratio;
  }

  function timeAtAngle(arc, angle) {
    let low = 0;
    let high = arc.map.length - 1;
    const direction = Math.sign(arc.endAngle - arc.startAngle);
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if ((arc.map[mid].angle - angle) * direction <= 0) low = mid;
      else high = mid;
    }
    const a = arc.map[low];
    const b = arc.map[high];
    return a.time + (b.time - a.time) * (angle - a.angle) / (b.angle - a.angle);
  }

  function createPlan({ ratio = 0.5, length = 1, gravity = 9.8 } = {}) {
    const r = clamp(ratio, 0.2, 1) * length;
    const origin = { x: 0, y: length };
    const peg = { x: 0, y: r };
    const approach = makeArc({
      pivot: origin, radius: length, energyHeight: length,
      startAngle: -Math.PI / 2, endAngle: 0
    }, gravity);
    const passes = r <= 0.4 * length + 1e-12;
    const ordinaryPendulum = Math.abs(r - length) < 1e-12;
    const endAngle = passes ? TWO_PI : Math.acos(clamp((2 - 2 * length / r) / 3, -1, 1));
    const circle = makeArc({
      pivot: peg, radius: r, energyHeight: length,
      startAngle: 0, endAngle
    }, gravity);
    const circleEnd = approach.duration + circle.duration;
    const events = [{ key: "entry", label: "円運動", time: approach.duration }];
    const plan = {
      ratio: r / length, length, gravity, r, origin, peg, approach, circle,
      passes, ordinaryPendulum, circleEnd, duration: circleEnd, events,
      outcome: passes ? "pass" : ordinaryPendulum ? "turn" : "slack",
      maximumTension: 1 + 2 * length / r
    };
    if (passes) {
      events.push({ key: "top", label: "頂点", time: approach.duration + timeAtAngle(circle, Math.PI) });
    } else if (ordinaryPendulum) {
      events.push({ key: "turn", label: "折り返し", time: circleEnd });
    } else {
      events.push({ key: "slack", label: "張力0", time: circleEnd });
      const launch = arcState(circle, endAngle, gravity);
      // With zero tension at release, the next |position - peg| = r occurs at 4 vy / g.
      const flightDuration = 4 * launch.velocity.y / gravity;
      plan.flight = { launch, duration: flightDuration };
      plan.duration += flightDuration;
    }
    plan.snapTimes = [0, ...events.map((event) => event.time), plan.duration];
    return plan;
  }

  function sample(plan, time) {
    const t = clamp(time, 0, plan.duration);
    let result;
    if (t < plan.approach.duration) {
      result = arcState(plan.approach, angleAtTime(plan.approach, t), plan.gravity);
      result.phase = "approach";
    } else if (t <= plan.circleEnd || !plan.flight) {
      result = arcState(plan.circle, angleAtTime(plan.circle, t - plan.approach.duration), plan.gravity);
      result.phase = "circle";
    } else {
      const elapsed = t - plan.circleEnd;
      const launch = plan.flight.launch;
      result = {
        position: {
          x: launch.position.x + launch.velocity.x * elapsed,
          y: launch.position.y + launch.velocity.y * elapsed - plan.gravity * elapsed * elapsed / 2
        },
        velocity: { x: launch.velocity.x, y: launch.velocity.y - plan.gravity * elapsed },
        tension: 0, tensionDirection: { x: 0, y: 0 },
        phase: "flight", taut: false, pivot: plan.peg, radius: plan.r
      };
    }
    result.time = t;
    result.finished = t >= plan.duration;
    return result;
  }

  // SI units for position/time/velocity; tension is S/(mg), so it can be compared across masses.
  const api = { createPlan, sample, makeArc, arcState, angleAtTime, timeAtAngle };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PendulumPegPhysics = api;
})(typeof globalThis === "object" ? globalThis : this);
