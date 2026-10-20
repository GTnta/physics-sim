# Kepler's Second Law

Published on 2026-10-21. The index status is public, not a provisional release.

## Model

- An ideal two-body ellipse with a fixed focus. The semimajor axis `a` and orbital period `T` stay fixed while eccentricity changes from 0 to 0.85.
- Mean anomaly advances uniformly in time. `astronomia` 4.2.0 solves `M = E - e sin(E)`; the eccentric anomaly does not advance uniformly.
- Positions and analytic velocities use the same eccentric anomaly. Areal velocity is checked independently by `|r cross v| / 2`.
- Equal-time comparisons use curved ellipse sectors, not triangles joining two orbital positions. The first window is centered on periapsis: it starts at `-DeltaT/2` and ends at `+DeltaT/2`, with time measured from periapsis. The other two windows start at `0.35T` and `0.70T`. All remain non-overlapping for the selectable duration range. The positions are deterministic and cannot be reshuffled.
- Instantaneous comparisons use the triangles with vertices `F`, `P`, `P + v*T/30`. The common multiplier `T/30` makes lengths dimensionally consistent; the tip is not the future orbital position.
- The orbital plane is horizontal in the drawing; the Sun is at the left focus. At zero eccentricity, the focus coincides with the center and the periapsis/apoapsis button becomes a left/right selection.

Animation timing is a presentation choice: one orbit takes 8 real seconds at 1x. Equal-time sectors fill in 3.2 real seconds and then hold their final state. These display durations do not change the physics.

## Checks

`tools/run-local-node.ps1 -Script kepler-laws/kepler-physics.test.js`

Tests cover the Kepler residual, conic geometry, energy, analytic vs. finite-difference velocity, exact and polygonal swept areas, triangle areas, phase wrapping, and the circular limit.

The browser checks cover desktop/iPad portrait/iPad landscape/mobile, minimum and maximum eccentricity, replay, scrubbing, reset scope, orientation changes while playing, idle RAF cancellation, native touch dragging and background scrolling. These are emulated viewport/touch checks, not physical-iPad frame-rate measurements.

## Sources and Assets

- [NASA: Orbits and Kepler's Laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/) — equal swept areas and orbital-speed variation.
- [NASA: Kepler's Second Law](https://pwg.gsfc.nasa.gov/stargaze/Skepl2nd.htm) — orbital-plane geometry and areal velocity.
- [astronomia 4.2.0](https://github.com/commenthol/astronomia/tree/v4.2.0) — vendored Kepler-equation solver; see `vendor/README.md` and license.
- Lucide icons are embedded from the repository's existing play/pause/rotate-ccw symbols. No runtime network request is needed.

The index thumbnail is a generated raster asset, `assets/index-icons/kepler-second-law-generated.png`, matching the existing warm-gradient and bold-white-line mechanics icons. It schematically compares a broad near-focus sector with a narrow far-focus sector. The original and actual 54px index rendering were reviewed for focal placement, curved boundaries, area balance, line weight, and clean joins. This artwork is not used for numerical physics validation. See `docs/kepler-second-law-icon-prompt.md` for the generation prompt and review record.
