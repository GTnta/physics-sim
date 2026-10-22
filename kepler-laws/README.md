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

# Kepler's Third Law (Prototype)

`kepler-third-law.html` compares two test particles around the same fixed Sun. It reuses the second-law solver; planet-planet interactions are ignored. Both ellipses have the same adjustable eccentricity and share a focus and drawing scale, not an ellipse center.

- Relative units set `T = a^(3/2)`, equivalent to a common gravitational parameter `mu = 4*pi^2`. Changing eccentricity does not change the period.
- Both planets use the same elapsed time. Each analog stopwatch hand rotates uniformly through `2*pi*t/T`; it does not track the nonuniform true anomaly. The lap counter and planet position derive from that same phase, including at exact period boundaries.
- Initial axes are 1 and 2, eccentricity is 0.5, playback is paused, and one time unit takes four real seconds at 1x. Each orbit loops independently; common time continues. The timeline extends rather than wrapping both planets together.
- A time scrub pauses playback and snaps near the first completed orbit of each planet. Arrow keys cross and leave those markers without sticking. Parameter changes restart both at common time zero while preserving the playback state. `t = 0` pauses; reset restores all conditions and display switches, then pauses.
- The default is two side-by-side views: A is opaque in the left view and B in the right; the other planet, orbit and radius line use one-quarter opacity. Both views retain the same scale, shared focus and physical time. The single-view switch overlays both at full emphasis without resetting time or playback.
- Split-view line style follows emphasis: the main orbit is solid, and the secondary orbit is dotted. The single view retains its original solid-A/dashed-B styles. The formula comparison is visible initially and after reset; its switch can still hide it.
- Thin dotted major/minor axes pass through each ellipse's center (not the Sun), reach the ellipse boundary, and are visible by default. The guide switch hides both axes. Orbital fitting uses the larger ellipse and keeps a common scale for both planets. Marker sizes are schematic.
- Each compact clock has radius 22 CSS pixels and 12 simple ticks. The split views show their main planet's clock in an upper corner; the single view shows both on the right. Hand phase and lap counting are unchanged.
- The prototype index entry uses `assets/index-icons/kepler-third-law-generated.png`, generated with the built-in image tool. Two different-sized ellipses and two stopwatches distinguish period comparison from the second-law icon's swept sectors. The original, 54px rendering and actual index cards were reviewed; see `docs/kepler-third-law-icon-prompt.md`. No formal-release log was added.

Numerical checks: `tools/run-local-node.ps1 -Script kepler-laws/kepler-third-law-physics.test.js`. These cover the common central mass, period relation, shared-focus geometry, orbital closure, energy, exact lap boundaries, uniform clock phase, and circular limit.

Browser checks: `tools/run-local-node.ps1 -Script kepler-laws/kepler-third-law.browser.test.js`. The headless Edge checks capture both view modes on desktop, iPad-equivalent portrait/landscape, reduced-height and mobile; verify the guide endpoints and ellipse centers, equal view scales, secondary opacity, compact clocks, and both hand angles against common time; and cover period-marker snapping, keyboard escape, reset, continued playback on resize/view switch, native touch scrolling, nonblank canvas pixels, idle RAF cancellation, and the index link. These are browser checks, not physical-iPad measurements.
