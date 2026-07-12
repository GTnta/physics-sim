const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return fallback;
}

const dataPath = path.resolve(repoRoot, readArg("--data", "data/index.json"));
const templatePath = path.resolve(repoRoot, readArg("--template", "tools/index-template.html"));
const outputPath = path.resolve(repoRoot, readArg("--output", "index.html"));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return String(text)
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

function normalizeSvg(svg) {
  return String(svg || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderIcon(icon = {}) {
  const theme = icon.theme ? ` ${escapeAttr(icon.theme)}` : "";
  if (icon.type === "image") {
    const src = escapeAttr(icon.src || "");
    const alt = escapeAttr(icon.alt || "");
    return [
      `<div class="icon${theme} is-image" aria-hidden="${alt ? "false" : "true"}">`,
      `  <img src="${src}" alt="${alt}" loading="lazy" decoding="async">`,
      `</div>`,
    ].join("\n");
  }
  return [
    `<div class="icon${theme}" aria-hidden="true">`,
    indent(normalizeSvg(icon.svg), 2),
    `</div>`,
  ].join("\n");
}

function renderCard(card) {
  const cardClasses = ["card"];
  if (card.soon) cardClasses.push("is-soon");
  const statusClasses = ["status"];
  if (card.status?.soon) statusClasses.push("soon");
  const ctaClasses = ["cta"];
  if (card.soon) ctaClasses.push("soon");
  const aria = card.ariaLabel ? ` aria-label="${escapeAttr(card.ariaLabel)}"` : "";
  const meta = (card.meta || [])
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("\n");

  return [
    `<a class="${cardClasses.join(" ")}" href="${escapeAttr(card.href)}"${aria}>`,
    `  <div class="card-top">`,
    indent(renderIcon(card.icon), 4),
    `    <span class="${statusClasses.join(" ")}">${escapeHtml(card.status?.text || "")}</span>`,
    `  </div>`,
    `  <div>`,
    `    <div class="field">${escapeHtml(card.field)}</div>`,
    `    <h3>${escapeHtml(card.title)}</h3>`,
    `    <p>${escapeHtml(card.description)}</p>`,
    `  </div>`,
    `  <div class="meta">`,
    indent(meta, 4),
    `  </div>`,
    `  <span class="${ctaClasses.join(" ")}">${escapeHtml(card.cta || "開く")}</span>`,
    `</a>`,
  ].join("\n");
}

function renderUnit(unit) {
  const description = unit.description
    ? `\n        <p>${escapeHtml(unit.description)}</p>`
    : "";
  const cards = (unit.cards || []).map(renderCard).join("\n\n");
  return [
    `<section class="unit-block" aria-labelledby="${escapeAttr(unit.id)}">`,
    `  <div class="unit-head">`,
    `    <h4 id="${escapeAttr(unit.id)}">${escapeHtml(unit.title)}</h4>${description}`,
    `  </div>`,
    `  <div class="sim-grid">`,
    indent(cards, 4),
    `  </div>`,
    `</section>`,
  ].join("\n");
}

function renderCategory(category) {
  const units = (category.units || []).map(renderUnit).join("\n\n");
  return [
    `<section class="category-block" aria-labelledby="${escapeAttr(category.id)}">`,
    `  <div class="category-head">`,
    `    <div>`,
    `      <h3 id="${escapeAttr(category.id)}">${escapeHtml(category.title)}</h3>`,
    `      <p>${escapeHtml(category.description)}</p>`,
    `    </div>`,
    `  </div>`,
    ``,
    `  <div class="unit-stack">`,
    indent(units, 4),
    `  </div>`,
    `</section>`,
  ].join("\n");
}

function renderCategories(data) {
  const categories = (data.categories || []).map(renderCategory).join("\n\n");
  return [
    `<!-- Generated from data/index.json by tools/build-index.js. Edit the data file, then rebuild. -->`,
    `<div class="category-stack">`,
    indent(categories, 2),
    `</div>`,
  ].join("\n");
}

function renderLogs(data) {
  const logs = (data.logs || [])
    .map((entry) =>
      [
        `<article class="log-item">`,
        `  <div class="log-date">${escapeHtml(entry.date)}</div>`,
        `  <p>${escapeHtml(entry.text)}</p>`,
        `</article>`,
      ].join("\n")
    )
    .join("\n");

  return [
    `<div class="log-list">`,
    indent(logs, 2),
    `</div>`,
  ].join("\n");
}

function renderArchive(data) {
  const archive = data.archive || {};
  const links = (archive.links || [])
    .map((link) => `<a class="archive-link" href="${escapeAttr(link.href)}">${escapeHtml(link.text)}</a>`)
    .join("\n");
  if (!archive.label && !links) return "";
  return [
    `<div class="archive-block" aria-label="${escapeAttr(archive.label || "")}">`,
    `  <div class="archive-label">${escapeHtml(archive.label || "")}</div>`,
    indent(links, 2),
    `</div>`,
  ].join("\n");
}

function main() {
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace(/^[ \t]*<!-- INDEX_CATEGORIES -->/m, indent(renderCategories(data), 6));
  html = html.replace(/^[ \t]*<!-- INDEX_LOGS -->/m, indent(renderLogs(data), 6));
  html = html.replace(/^[ \t]*<!-- INDEX_ARCHIVE -->/m, indent(renderArchive(data), 6));

  if (html.includes("<!-- INDEX_CATEGORIES -->") || html.includes("<!-- INDEX_LOGS -->")) {
    throw new Error("Template placeholders were not replaced.");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`Built ${path.relative(repoRoot, outputPath)}`);
}

main();
