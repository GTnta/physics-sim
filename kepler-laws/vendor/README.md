# Local Kepler Solver

`astronomia-kepler-4.2.0.js` bundles the `kepler3` export from
[`astronomia` 4.2.0](https://github.com/commenthol/astronomia/tree/v4.2.0),
including its required positive-modulo helper. The upstream solver is unmodified.
It uses a bounded binary search rather than a potentially divergent Newton iteration.

Build: esbuild 0.25.0, IIFE format, global `AstronomiaKepler`, target ES2019,
tree-shaking and minification enabled. A CommonJS export footer supports tests.
The original MIT license is included in `LICENSE-astronomia.txt`.
The simulator has no CDN or runtime network dependency.

The CSS embeds the existing Lucide play/pause/rotate-ccw symbols as SVG data
URLs, so CSS masks also work with `file://` pages. See `LICENSE-lucide.txt`.
