(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReflectionPhysics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LENGTH = 12;
  const START = 3;
  const defaults = Object.freeze({ mode: "pulse", amplitude: 1, width: 3, wavelength: 4, speed: 2, polarity: 1 });

  function pulse(z, width) {
    if (Math.abs(z) >= width / 2) return 0;
    return Math.cos(Math.PI * z / width);
  }

  function source(time, config) {
    if (time <= 0) return 0;
    const period = config.wavelength / config.speed;
    return config.polarity * config.amplitude * Math.sin(2 * Math.PI * time / period);
  }

  function incidentAt(x, time, config = defaults) {
    if (config.mode === "pulse") {
      return config.polarity * config.amplitude * pulse(x - START - config.speed * time, config.width);
    }
    return source(time - x / config.speed, config);
  }

  function sample(x, time, boundary, config = defaults) {
    // A mirrored incident wave enforces the end condition, including during overlap.
    const incident = incidentAt(x, time, config);
    const reflected = (boundary === "fixed" ? -1 : 1) * incidentAt(2 * LENGTH - x, time, config);
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

  function standingMarkers(time, boundary, config) {
    if (config.mode !== "continuous") return [];
    const spacing = config.wavelength / 4;
    const markers = [];
    for (let i = 0; i <= Math.floor(LENGTH / spacing + 1e-9); i++) {
      const x = Math.max(0, LENGTH - i * spacing);
      // A standing pattern exists only where the reflected wave has arrived.
      if (time + 1e-9 < (2 * LENGTH - x) / config.speed) continue;
      const antinode = (i % 2 === 0) === (boundary === "free");
      markers.push({ x, type: antinode ? "antinode" : "node" });
    }
    return markers;
  }

  return Object.freeze({ LENGTH, START, defaults, pulse, source, incidentAt, sample, arrival, duration, standingMarkers });
});
