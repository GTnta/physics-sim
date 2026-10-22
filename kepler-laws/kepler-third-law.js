(() => {
  "use strict";
  const physics = window.KeplerThirdLaw;
  const $ = id => document.getElementById(id);
  const canvas = $("orbitCanvas");
  const ctx = canvas.getContext("2d");
  const background = document.createElement("canvas");
  const bg = background.getContext("2d");
  const colors = ["#2f7d8f", "#c45d3b"];
  const defaults = { axes: [1, 2], e: .5, rate: 1 };
  const secondsPerUnit = 4;
  const state = { axes: [...defaults.axes], e: defaults.e, rate: defaults.rate, time: 0, playing: false, showAxes: true, singleView: false };
  let orbits, layout, timeEnd, raf = 0, previousStamp = null, lastReadout = -Infinity, pointerScrubbing = false;
  const fixed = value => value.toFixed(2);
  function write(id, value) {
    const node = $(id);
    if (node.textContent !== value) node.textContent = value;
  }
  function rebuildOrbits() {
    orbits = state.axes.map(a => physics.createOrbit(a, state.e));
    timeEnd = Math.max(...orbits.map(orbit => orbit.period)) * 3;
    $("timeSlider").max = timeEnd;
    $("axisASlider").value = state.axes[0];
    $("axisBSlider").value = state.axes[1];
    $("eccentricitySlider").value = state.e;
    ["A", "B"].forEach((name, index) => {
      write(`axis${name}Value`, fixed(state.axes[index]));
      write(`tableAxis${name}`, fixed(state.axes[index]));
      write(`period${name}`, fixed(orbits[index].period));
      write(`constant${name}`, fixed(orbits[index].period ** 2 / orbits[index].a ** 3));
    });
    write("eccentricityValue", fixed(state.e));
    write("ratioAxis", fixed(state.axes[1] / state.axes[0]));
    write("ratioPeriod", fixed(orbits[1].period / orbits[0].period));
    updateMarks();
    resize();
  }
  function updateMarks() {
    const same = Math.abs(orbits[0].period - orbits[1].period) < 1e-8;
    ["A", "B"].forEach((name, index) => {
      const mark = $(`mark${name}`);
      mark.style.left = `${100 * orbits[index].period / timeEnd}%`;
      mark.hidden = same && index === 1;
      mark.textContent = same ? "A・B 1周" : `${name} 1周`;
    });
    // Nearby labels occupy separate levels, while their ticks retain exact times.
    const near = !same && Math.abs(orbits[0].period - orbits[1].period) / timeEnd < .16;
    $("markB").classList.toggle("lower-mark", near);
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    canvas.setAttribute("aria-label", state.singleView
      ? "共通の太陽を回る2つの惑星と、それぞれの周期で1回転する時計"
      : "左は惑星A、右は惑星Bを強調した軌道と、それぞれの周期で1回転する時計");
    const dpr = Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2);
    canvas.width = background.width = Math.round(width * dpr);
    canvas.height = background.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const largest = orbits.reduce((a, b) => a.a > b.a ? a : b);
    const count = state.singleView ? 1 : 2;
    const viewWidth = width / count;
    const clockWidth = state.singleView ? 78 : 0;
    const plotWidth = viewWidth - clockWidth;
    const padding = width < 500 ? 14 : 26;
    const scale = Math.min((plotWidth - 2 * padding) / (2 * largest.a), (height - 2 * padding) / (2 * largest.b));
    const left = -largest.a * (1 - state.e), right = largest.a * (1 + state.e);
    const views = Array.from({ length: count }, (_, index) => ({
      left: index * viewWidth, width: viewWidth, scale,
      main: state.singleView ? null : index,
      originX: index * viewWidth + plotWidth / 2 - (left + right) * scale / 2,
      originY: height / 2,
      clocks: state.singleView
        ? [0, 1].map(planet => ({ planet, x: width - 39, y: height * (planet === 0 ? .28 : .72), r: 22 }))
        : [{ planet: index, x: (index + 1) * viewWidth - 35, y: 34, r: 22 }]
    }));
    layout = { width, height, dpr, views };
    paintBackground();
    draw();
  }
  const point = (view, x, y) => ({ x: view.originX + x * view.scale, y: view.originY - y * view.scale });
  const weight = (view, index) => view.main === null || view.main === index ? 1 : .25;
  const paintOrder = view => view.main === null ? [1, 0] : [1 - view.main, view.main];
  function clipView(context, view) {
    context.beginPath(); context.rect(view.left, 0, view.width, layout.height); context.clip();
  }
  function line(context, x1, y1, x2, y2) {
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
  }
  function dot(context, x, y, radius, color) {
    context.beginPath(); context.arc(x, y, radius, 0, 2 * Math.PI); context.fillStyle = color; context.fill();
  }
  function paintBackground() {
    const l = layout;
    bg.clearRect(0, 0, l.width, l.height);
    bg.fillStyle = "#ffffff"; bg.fillRect(0, 0, l.width, l.height);
    l.views.forEach(view => {
      bg.save(); clipView(bg, view);
      paintOrder(view).forEach(index => {
        const orbit = orbits[index];
        const center = point(view, orbit.a * orbit.e, 0);
        const rx = orbit.a * view.scale, ry = orbit.b * view.scale;
        if (state.showAxes) {
          bg.strokeStyle = "#71858b"; bg.lineWidth = 1; bg.globalAlpha = .34 * weight(view, index);
          bg.setLineDash([2, 5]); bg.lineCap = "round";
          line(bg, center.x - rx, center.y, center.x + rx, center.y);
          line(bg, center.x, center.y - ry, center.x, center.y + ry);
        }
        bg.beginPath(); bg.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
        bg.strokeStyle = colors[index]; bg.lineWidth = 2; bg.globalAlpha = .7 * weight(view, index);
        const secondary = view.main !== null && index !== view.main;
        bg.setLineDash(view.main === null ? (index === 0 ? [] : [8, 5]) : (secondary ? [2, 6] : []));
        bg.lineCap = secondary ? "round" : "butt"; bg.stroke();
        bg.setLineDash([]); bg.globalAlpha = 1;
      });
      dot(bg, view.originX, view.originY, 11, "rgba(231,175,55,.15)");
      dot(bg, view.originX, view.originY, 7, "#e7af37");
      if (view.main !== null) {
        bg.font = 'bold 16px "Yu Gothic UI", Meiryo, sans-serif';
        bg.textAlign = "left"; bg.fillStyle = colors[view.main];
        bg.fillText(view.main === 0 ? "A" : "B", view.left + 18, 30);
      }
      view.clocks.forEach(clock => paintDial(clock.x, clock.y, clock.r));
      bg.restore();
    });
    if (l.views.length === 2) {
      bg.strokeStyle = "rgba(22,50,60,.12)"; bg.lineWidth = 1;
      line(bg, l.width / 2, 16, l.width / 2, l.height - 16);
    }
  }
  function paintDial(x, y, r) {
    bg.strokeStyle = "#879999"; bg.lineWidth = 1;
    bg.beginPath(); bg.arc(x, y, r, 0, 2 * Math.PI); bg.stroke();
    line(bg, x - 3, y - r - 3, x + 3, y - r - 3);
    line(bg, x, y - r - 3, x, y - r);
    for (let tick = 0; tick < 12; tick++) {
      const angle = tick * Math.PI / 6 - Math.PI / 2;
      const outer = r - 3, inner = outer - (tick % 3 === 0 ? 4 : 2);
      bg.strokeStyle = tick % 3 === 0 ? "#728889" : "#c1cdcc";
      line(bg, x + Math.cos(angle) * inner, y + Math.sin(angle) * inner, x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    }
  }
  function draw() {
    if (!layout) return;
    const l = layout;
    ctx.clearRect(0, 0, l.width, l.height);
    ctx.drawImage(background, 0, 0, background.width, background.height, 0, 0, l.width, l.height);
    const positions = orbits.map(orbit => physics.sample(orbit, state.time));
    l.views.forEach(view => {
      ctx.save(); clipView(ctx, view);
      const pixels = positions.map(p => point(view, p.x, p.y));
      const order = paintOrder(view);
      order.forEach(index => {
        const pixel = pixels[index];
        ctx.strokeStyle = colors[index]; ctx.lineWidth = 1; ctx.globalAlpha = .27 * weight(view, index);
        line(ctx, view.originX, view.originY, pixel.x, pixel.y);
      });
      // In the combined view, retain both colors when the planets coincide.
      const overlap = view.main === null && Math.hypot(pixels[0].x - pixels[1].x, pixels[0].y - pixels[1].y) < 13;
      order.forEach(index => {
        const p = pixels[index], radius = overlap && index === 1 ? 9 : 6.5;
        ctx.globalAlpha = weight(view, index);
        dot(ctx, p.x, p.y, radius, colors[index]);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      view.clocks.forEach(({ planet, x, y, r }) => {
        const reading = positions[planet].clock;
        ctx.strokeStyle = colors[planet]; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        line(ctx, x, y, x + Math.cos(reading.angle) * (r - 6), y + Math.sin(reading.angle) * (r - 6));
        dot(ctx, x, y, 2.5, colors[planet]); ctx.lineCap = "butt";
        ctx.fillStyle = colors[planet]; ctx.textAlign = "center";
        ctx.font = '12px "Yu Gothic UI", Meiryo, sans-serif';
        ctx.fillText(`${planet === 0 ? "A" : "B"}　${reading.laps} 周`, x, y + r + 15);
      });
      ctx.restore();
    });
  }
  function updateTime() {
    if (state.time > timeEnd) {
      const slowPeriod = Math.max(...orbits.map(orbit => orbit.period));
      timeEnd = (Math.ceil(state.time / slowPeriod) + 1) * slowPeriod;
      $("timeSlider").max = timeEnd;
      updateMarks();
    }
    write("timeValue", fixed(state.time));
    $("timeSlider").value = state.time;
    $("timeSlider").setAttribute("aria-valuetext", `時刻 ${fixed(state.time)}`);
  }
  function schedule() {
    if (state.playing && !document.hidden && !raf) raf = requestAnimationFrame(tick);
  }
  function tick(stamp) {
    raf = 0;
    if (!state.playing || document.hidden) return;
    if (previousStamp !== null) state.time += (stamp - previousStamp) / 1000 * state.rate / secondsPerUnit;
    previousStamp = stamp;
    draw();
    if (stamp - lastReadout > 75) { updateTime(); lastReadout = stamp; }
    schedule();
  }
  function setPlaying(playing) {
    state.playing = playing;
    previousStamp = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const icon = $("playButton").querySelector(".icon");
    icon.className = `icon ${playing ? "pause-icon" : "play-icon"}`;
    write("playLabel", playing ? "一時停止" : "再生");
    $("playButton").setAttribute("aria-pressed", String(playing));
    updateTime(); schedule();
  }
  function seek(time) {
    setPlaying(false);
    state.time = Math.max(0, Math.min(timeEnd, time));
    updateTime(); draw();
  }
  function resetTime() {
    state.time = 0;
    setPlaying(false);
    timeEnd = Math.max(...orbits.map(orbit => orbit.period)) * 3;
    $("timeSlider").max = timeEnd;
    updateMarks(); updateTime(); draw();
  }
  $("playButton").addEventListener("click", () => setPlaying(!state.playing));
  $("zeroButton").addEventListener("click", resetTime);
  $("resetButton").addEventListener("click", () => {
    state.axes = [...defaults.axes]; state.e = defaults.e; state.rate = defaults.rate;
    state.showAxes = true; state.singleView = false; state.time = 0;
    $("axisToggle").checked = true; $("singleViewToggle").checked = false; $("formulaToggle").checked = true;
    $("rateSlider").value = state.rate; write("rateValue", `${fixed(state.rate)}×`);
    showFormula(true); setPlaying(false); rebuildOrbits(); updateTime();
  });
  ["axisASlider", "axisBSlider", "eccentricitySlider"].forEach(id => {
    $(id).addEventListener("input", () => {
      state.axes = [Number($("axisASlider").value), Number($("axisBSlider").value)];
      state.e = Number($("eccentricitySlider").value); state.time = 0; previousStamp = null;
      rebuildOrbits(); updateTime();
    });
  });
  $("rateSlider").addEventListener("input", () => {
    state.rate = Number($("rateSlider").value); previousStamp = null;
    write("rateValue", `${fixed(state.rate)}×`);
  });
  $("axisToggle").addEventListener("change", event => {
    state.showAxes = event.target.checked; paintBackground(); draw();
  });
  $("singleViewToggle").addEventListener("change", event => {
    state.singleView = event.target.checked;
    resize();
  });
  function showFormula(show) {
    document.querySelectorAll(".law-column").forEach(node => { node.hidden = !show; });
    $("lawSummary").hidden = !show;
  }
  $("formulaToggle").addEventListener("change", event => showFormula(event.target.checked));
  const slider = $("timeSlider");
  slider.addEventListener("pointerdown", () => { pointerScrubbing = true; });
  window.addEventListener("pointerup", () => { pointerScrubbing = false; });
  window.addEventListener("pointercancel", () => { pointerScrubbing = false; });
  slider.addEventListener("input", () => {
    let target = Number(slider.value);
    if (pointerScrubbing) {
      const threshold = timeEnd * 7 / Math.max(1, slider.clientWidth - 16);
      const markers = [0, ...orbits.map(orbit => orbit.period)];
      const closest = markers.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
      if (Math.abs(closest - target) < threshold) target = closest;
    }
    seek(target);
  });
  slider.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return seek(0);
    if (event.key === "End") return seek(timeEnd);
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1;
    let target = state.time + direction * timeEnd / 200;
    const crossed = orbits.map(orbit => orbit.period).filter(time => direction * (time - state.time) > 1e-8 && direction * (target - time) >= 0);
    if (crossed.length) target = direction > 0 ? Math.min(...crossed) : Math.max(...crossed);
    seek(target);
  });
  document.addEventListener("visibilitychange", () => {
    previousStamp = null;
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    else schedule();
  });
  rebuildOrbits(); setPlaying(false);
  new ResizeObserver(resize).observe(canvas);
})();
