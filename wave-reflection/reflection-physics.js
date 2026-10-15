(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReflectionPhysics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LENGTH = 12;
  const START = 3;
  const defaults = Object.freeze({ mode: "pulse", amplitude: 1, width: 3, wavelength: 3, speed: 2, polarity: 1 });

  function pulse(z, width) {
    if (Math.abs(z) >= width / 2) return 0;
    return Math.cos(Math.PI * z / width) ** 2;
  }

  function source(time, config) {
    if (time <= 0) return 0;
    const period = config.wavelength / config.speed;
    const ramp = Math.sin(Math.PI / 2 * Math.min(time / (period / 2), 1)) ** 2;
    return config.polarity * config.amplitude * ramp * Math.sin(2 * Math.PI * time / period);
  }

  function sample(x, time, boundary, config = defaults) {
    const sign = boundary === "fixed" ? -1 : 1;
    let incident, reflected;
    if (config.mode === "pulse") {
      incident = config.polarity * config.amplitude * pulse(x - START - config.speed * time, config.width);
      reflected = sign * config.polarity * config.amplitude * pulse(2 * LENGTH - x - START - config.speed * time, config.width);
    } else {
      // Retarded source times give a causal wavefront and satisfy the end condition at every time.
      incident = source(time - x / config.speed, config);
      reflected = sign * source(time - (2 * LENGTH - x) / config.speed, config);
    }
    return { incident, reflected, total: incident + reflected };
  }

  function arrival(config) {
    return (config.mode === "pulse" ? LENGTH - START : LENGTH) / config.speed;
  }

  function duration(config) {
    return config.mode === "pulse"
      ? (2 * LENGTH - START + config.width / 2) / config.speed
      : 2 * LENGTH / config.speed + 4 * config.wavelength / config.speed;
  }

  return Object.freeze({ LENGTH, START, defaults, pulse, source, sample, arrival, duration });
});
