"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const physics = require("./kepler-third-law-physics.js");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".tmp", "kepler-third-law");
const url = pathToFileURL(path.join(__dirname, "kepler-third-law.html")).href;
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure().errorText}`));
    await page.addInitScript(() => {
      window.__qa = { frames: 0, lines: [], labels: [], staticLines: [], ellipses: [], faces: [], orbitStrokes: [] };
      const nativeRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => nativeRAF.call(window, stamp => { window.__qa.frames++; callback(stamp); });
      const prototype = CanvasRenderingContext2D.prototype;
      const moves = new WeakMap();
      const ellipsePaths = new WeakMap();
      for (const method of ["clearRect", "beginPath", "moveTo", "lineTo", "fillText", "ellipse", "arc", "stroke"]) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          const main = this.canvas.id === "orbitCanvas";
          if (method === "beginPath") ellipsePaths.delete(this);
          if (method === "moveTo") moves.set(this, args);
          if (main) {
            if (method === "clearRect") { window.__qa.lines = []; window.__qa.labels = []; }
            if (method === "lineTo") window.__qa.lines.push({ start: moves.get(this), end: args, color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha });
            if (method === "fillText") window.__qa.labels.push(args[0]);
          } else {
            if (method === "clearRect") { window.__qa.staticLines = []; window.__qa.ellipses = []; window.__qa.faces = []; window.__qa.orbitStrokes = []; }
            if (method === "lineTo") window.__qa.staticLines.push({ start: moves.get(this), end: args, dash: this.getLineDash() });
            if (method === "ellipse") { window.__qa.ellipses.push(args); ellipsePaths.set(this, args); }
            if (method === "stroke" && ellipsePaths.has(this)) window.__qa.orbitStrokes.push({ dash: this.getLineDash(), alpha: this.globalAlpha, color: this.strokeStyle });
            if (method === "arc" && args[2] === 22) window.__qa.faces.push(args);
          }
          return original.apply(this, args);
        };
      }
    });
    await page.goto(url);
    await page.waitForTimeout(150);
    assert.equal(await page.locator("#formulaToggle").isChecked(), true, "formula comparison is enabled initially");
    assert.equal(await page.locator("#lawSummary").isVisible(), true);
    const input = async (id, value) => page.locator(`#${id}`).evaluate((node, next) => {
      node.value = next; node.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    const time = () => page.locator("#timeSlider").inputValue().then(Number);
    const checkDrawing = async () => {
      const single = await page.locator("#singleViewToggle").isChecked();
      const frame = await page.evaluate(() => window.__qa);
      const radial = frame.lines.filter(line => line.width === 1);
      assert.equal(radial.length, single ? 2 : 4, "all planets appear in each view");
      const opacity = radial.map(line => Number(line.alpha.toFixed(4)));
      assert.deepEqual(opacity, single ? [.27, .27] : [.0675, .27, .0675, .27], "secondary planet and radius line are translucent");
      assert.equal(frame.faces.length, 2, "two compact clocks");
      assert.deepEqual(frame.orbitStrokes.map(stroke => stroke.dash), single ? [[8, 5], []] : [[2, 6], [], [2, 6], []], "split-view main is solid and secondary dotted; combined style is unchanged");
      const axes = frame.staticLines.filter(line => line.dash.join(",") === "2,5");
      assert.equal(axes.length, single ? 4 : 8, "horizontal and vertical dotted axes per ellipse");
      frame.ellipses.forEach(([x, y, rx, ry], index) => {
        const horizontal = axes[2 * index], vertical = axes[2 * index + 1];
        const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, "axes cross at ellipse center and reach its edges");
        near(horizontal.start[0], x - rx); near(horizontal.end[0], x + rx);
        near(horizontal.start[1], y); near(horizontal.end[1], y);
        near(vertical.start[0], x); near(vertical.end[0], x);
        near(vertical.start[1], y - ry); near(vertical.end[1], y + ry);
      });
      if (!single) {
        const span = frame.faces[1][0] - frame.faces[0][0];
        const leftA = radial[1], rightA = radial[2], leftB = radial[0], rightB = radial[3];
        assert.equal(leftA.color, rightA.color); assert.equal(leftB.color, rightB.color);
        for (const [left, right] of [[leftA, rightA], [leftB, rightB]]) {
          assert.ok(Math.abs(right.end[0] - left.end[0] - span) < 1e-6 && Math.abs(right.end[1] - left.end[1]) < 1e-6, "both views share scale and orbital state");
        }
      }
    };
    const checkLayout = async name => {
      const info = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const buttons = ["#playButton", "#zeroButton", "#rateSlider", "#resetButton"].map(rect);
        const parameters = [...document.querySelectorAll(".parameter")].map(node => node.getBoundingClientRect());
        const canvas = document.querySelector("canvas");
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0, blue = 0, orange = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 220 && data[i + 1] < 220 && data[i + 2] < 220) ink++;
          if (data[i] < 100 && data[i + 1] > 80 && data[i + 2] > data[i]) blue++;
          if (data[i] > 130 && data[i + 1] < 140 && data[i + 2] < 100) orange++;
        }
        const overflow = [...document.querySelectorAll("button, label, output, math, .time-marks")].filter(node => {
          const r = node.getBoundingClientRect();
          return r.width && (r.left < -1 || r.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 3);
        }).map(node => node.id || node.className || node.tagName);
        return { width: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, buttons: buttons.map(r => ({ x: r.x, y: r.y, width: r.width })), parameters: parameters.map(r => ({ y: r.y, bottom: r.bottom })), overflow, ink, blue, orange, touchAction: getComputedStyle(canvas).touchAction };
      });
      assert.ok(info.pageOverflow <= 1, `${name}: page overflow`);
      assert.deepEqual(info.overflow, [], `${name}: content overflow`);
      assert.ok(info.ink > 1200 && info.blue > 100 && info.orange > 100, `${name}: nonblank scene and both series`);
      assert.equal(info.touchAction, "pan-y pinch-zoom");
      if (info.width >= 768) {
        assert.ok(Math.max(...info.buttons.map(r => r.y)) - Math.min(...info.buttons.map(r => r.y)) < 30, `${name}: playback row`);
        assert.ok(Math.max(...info.parameters.map(r => r.y)) - Math.min(...info.parameters.map(r => r.y)) < 2, `${name}: parameter row`);
      }
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      console.log(`PASS ${name}: ${JSON.stringify(info)}`);
    };
    await input("timeSlider", .75);
    for (const [name, width, height] of [["desktop", 1280, 900], ["ipad-landscape", 1024, 768], ["ipad-portrait", 768, 1024], ["reduced-height", 1024, 640], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(80); await checkLayout(`${name}-split`); await checkDrawing();
      const before = await time();
      await page.locator("#singleViewToggle").check(); await checkLayout(`${name}-single`); await checkDrawing();
      assert.equal(await time(), before, "view switch keeps paused time");
      await page.locator("#singleViewToggle").uncheck();
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.locator("#formulaToggle").check(); await page.locator("#axisToggle").check();
    await input("axisASlider", .5); await input("axisBSlider", 3); await input("eccentricitySlider", .85); await input("timeSlider", .32);
    await checkLayout("eccentric-extreme");
    await input("eccentricitySlider", 0); await checkLayout("circles");
    await input("axisASlider", 2); await input("axisBSlider", 2); await input("eccentricitySlider", .5); await input("timeSlider", .75);
    await checkLayout("identical-orbits");
    assert.equal(await page.locator("#markA").textContent(), "A・B 1周");
    await input("axisASlider", 1.95); await checkLayout("nearby-periods");
    await page.locator("#singleViewToggle").check(); await page.locator("#axisToggle").uncheck();
    await page.locator("#formulaToggle").uncheck();
    assert.equal(await page.locator("#lawSummary").isVisible(), false);
    await page.locator("#resetButton").click();
    assert.equal(await time(), 0);
    assert.equal(await page.locator("#axisASlider").inputValue(), "1");
    assert.equal(await page.locator("#axisBSlider").inputValue(), "2");
    assert.equal(await page.locator("#eccentricitySlider").inputValue(), "0.5");
    assert.equal(await page.locator("#rateSlider").inputValue(), "1");
    assert.equal(await page.locator("#formulaToggle").isChecked(), true);
    assert.equal(await page.locator("#lawSummary").isVisible(), true, "reset restores visible formulas");
    assert.equal(await page.locator("#axisToggle").isChecked(), true);
    assert.equal(await page.locator("#singleViewToggle").isChecked(), false);
    const initialFrames = await page.evaluate(() => window.__qa.frames);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__qa.frames), initialFrames, "no idle RAF");
    await page.locator("#playButton").click(); await page.waitForTimeout(4250); await page.locator("#playButton").click();
    const currentTime = await time();
    const frame = await page.evaluate(() => window.__qa);
    assert.ok(currentTime > 1 && currentTime < 1.3);
    assert.ok(frame.labels.includes("A　1 周") && frame.labels.includes("B　0 周"));
    const hands = frame.lines.filter(line => line.width === 2.5);
    for (let index = 0; index < 2; index++) {
      const hand = hands[index];
      const actual = Math.atan2(hand.end[1] - hand.start[1], hand.end[0] - hand.start[0]);
      const expected = physics.clock(currentTime, physics.period(index + 1)).angle;
      assert.ok(Math.abs(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected))) < .02, "hand matches shared orbital time");
    }
    console.log("PASS playback: independent laps and both clock angles match orbital time");
    await page.locator("#zeroButton").click();
    assert.equal(await time(), 0); assert.equal(await page.locator("#playLabel").textContent(), "再生");
    const slider = page.locator("#timeSlider");
    const box = await slider.boundingBox();
    const end = Number(await slider.getAttribute("max"));
    await page.mouse.click(box.x + 8 + (box.width - 16) / end, box.y + box.height / 2);
    assert.equal(await time(), 1, "pointer snaps at first orbit A");
    await slider.press("ArrowRight"); assert.ok(await time() > 1, "keyboard leaves snap point");
    await slider.press("ArrowLeft"); assert.equal(await time(), 1, "keyboard crosses onto exact marker");
    await slider.press("ArrowLeft"); assert.ok(await time() < 1, "keyboard leaves backwards");
    const bPeriod = physics.period(2);
    await page.mouse.click(box.x + 8 + (box.width - 16) * bPeriod / end, box.y + box.height / 2);
    assert.ok(Math.abs(await time() - bPeriod) < .001, "pointer snaps at first orbit B");
    assert.ok((await page.evaluate(() => window.__qa.labels)).includes("B　1 周"), "exact marker finishes the corresponding lap");
    await slider.press("End");
    const oldEnd = await time(); await page.locator("#playButton").click(); await page.waitForTimeout(650); await page.locator("#playButton").click();
    assert.ok(await time() > oldEnd, "time continues past slider endpoint");
    assert.ok(Number(await slider.getAttribute("max")) > oldEnd, "timeline extends without joint orbit reset");
    await page.locator("#playButton").click();
    let previousTime = await time();
    for (const single of [true, false]) {
      await page.locator("#singleViewToggle").setChecked(single); await page.waitForTimeout(180);
      assert.ok(await time() > previousTime, "playback continues through view switch"); previousTime = await time();
      assert.equal(await page.locator("#playLabel").textContent(), "一時停止");
    }
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(220);
      assert.ok(await time() > previousTime, "playback continues through orientation change"); previousTime = await time();
    }
    await input("eccentricitySlider", .7);
    assert.equal(await time(), 0, "condition changes share a fresh starting time");
    assert.equal(await page.locator("#playLabel").textContent(), "一時停止");
    await page.locator("#zeroButton").click();
    await input("rateSlider", .35); await input("axisASlider", 2.5);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("#resetButton").click(); await input("timeSlider", .4);
    assert.equal(await page.locator("#rateSlider").inputValue(), "1", "reset restores speed as well as orbital conditions");
    await page.screenshot({ path: path.join(output, "preview.png"), fullPage: true });
    const touch = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const touchPage = await touch.newPage(); await touchPage.goto(url);
    const session = await touch.newCDPSession(touchPage);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: 470 }] });
    for (let index = 1; index <= 8; index++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 300, y: 470 - index * 18 }] });
      await touchPage.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await touchPage.waitForTimeout(180);
    assert.ok(await touchPage.evaluate(() => scrollY) > 30, "native background touch scroll is preserved");
    await touch.close();
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    const card = page.locator('a[href="./kepler-laws/kepler-third-law.html"]');
    assert.equal(await card.count(), 1);
    await card.scrollIntoViewIfNeeded();
    await card.locator("img").evaluate(image => image.decode());
    await card.screenshot({ path: path.join(output, "index-card.png") });
    await card.click(); await page.waitForURL(url);
    assert.deepEqual(errors, [], "browser resource/console errors");
    console.log("PASS timeline snapping, reset scope, continuous time, rotation, native touch scrolling, index link; no browser errors.");
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
