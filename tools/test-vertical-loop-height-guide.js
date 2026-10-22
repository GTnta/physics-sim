"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".tmp", "vertical-loop-height-guide");
const url = process.argv[2] || pathToFileURL(path.join(root, "circular-motion/vertical-loop-motion.html")).href;
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => errors.push(request.url()));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => {
      window.__heightGuide = [];
      const prototype = CanvasRenderingContext2D.prototype;
      const moves = new WeakMap();
      for (const method of ["clearRect", "moveTo", "lineTo"]) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          if (this.canvas.id === "mainCanvas") {
            if (method === "clearRect") window.__heightGuide = [];
            if (method === "moveTo") moves.set(this, args);
            if (method === "lineTo" && this.getLineDash().join(",") === "2,7") {
              window.__heightGuide.push({ start: moves.get(this), end: args, color: this.strokeStyle, width: this.lineWidth });
            }
          }
          return original.apply(this, args);
        };
      }
    });
    await page.goto(url);
    const input = async (id, value) => page.locator(`#${id}`).evaluate((node, next) => {
      node.value = next; node.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    const checkGuide = async () => {
      const current = await page.evaluate(() => ({
        guide: window.__heightGuide,
        release: screen(state.motion.release),
        actualHeight: params.height,
        position: screen(currentKinematics().position),
        overflow: document.documentElement.scrollWidth - innerWidth
      }));
      assert.equal(current.guide.length, 1, "one initial-height extension");
      const guide = current.guide[0];
      const near = (a, b) => assert.ok(Math.abs(a - b) < .01, `${a} != ${b}`);
      near(guide.start[0], current.release.x); near(guide.start[1], current.release.y);
      near(guide.end[1], guide.start[1]); near(guide.start[1], 478 - current.actualHeight * 124);
      near(guide.end[0], 740 + 2.2 * 124);
      assert.ok(guide.end[0] > 740 + 124 && guide.end[0] < 1036, "crosses loop and ends before normal-force meter");
      assert.equal(guide.color, "rgba(22, 50, 60, 0.22)"); assert.equal(guide.width, 1.5);
      assert.ok(current.overflow <= 1);
      return current;
    };
    for (const height of [0, .04, .5, 1, 2, 2.5, 3.2]) {
      await input("heightSlider", height); await checkGuide();
    }
    await input("heightSlider", 2);
    await page.locator("#playPauseButton").click(); await page.waitForTimeout(550);
    const playing = await checkGuide();
    assert.ok(Math.hypot(playing.position.x - playing.release.x, playing.position.y - playing.release.y) > 2, "object moves while guide remains fixed");
    await page.locator("#playPauseButton").click();
    await page.locator("#timeSlider").evaluate(node => { node.value = Number(node.max) * .7; node.dispatchEvent(new Event("input", { bubbles: true })); });
    await checkGuide();
    await input("heightSlider", 2);
    const canvas = page.locator("#mainCanvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    const handle = await page.locator("#heightDragLine").boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, bounds.y + (478 - 2.5 * 124) * bounds.height / 640, { steps: 6 }); await page.mouse.up();
    assert.equal(Number(await page.locator("#heightSlider").inputValue()), 2.5, "height drag updates comparison guide");
    await checkGuide();
    await input("heightSlider", 2);
    for (const [name, width, height] of [["desktop", 1280, 800], ["ipad-landscape", 1024, 768], ["ipad-portrait", 768, 1024]]) {
      await page.setViewportSize({ width, height }); await checkGuide();
      await canvas.screenshot({ path: path.join(output, `${name}.png`) });
      console.log(`PASS ${name}: initial guide at 2r, no overflow`);
    }
    await input("heightSlider", 2.5); await canvas.screenshot({ path: path.join(output, "height-limit.png") });
    await input("heightSlider", 3.2); await canvas.screenshot({ path: path.join(output, "maximum-height.png") });
    assert.deepEqual(errors, []);
    console.log("PASS heights 0..3.2r, fixed release reference during playback/scrub, height drag, meter boundary, browser resources.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
