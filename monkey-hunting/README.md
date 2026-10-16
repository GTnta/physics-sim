# Monkey-hunting simulator (draft)

Open `monkey-hunting.html`. All runtime dependencies are local, so the directory
also works from `file://` without a package manager or a CDN.

- `monkey-hunting-physics.js`: exact ballistic trajectories, release and ground events; usable in Node and browsers.
- `monkey-hunting.js`: one simulation clock, 2D canvas and controls.
- `monkey-scenes.js`: source for the two Three.js first-person views and Lucide icons.
- `monkey-scenes.bundle.js`: committed browser bundle. Rebuild when the scene source changes.
- `THIRD-PARTY-LICENSES.txt`: bundled library notices.

The first-person cameras translate with their respective bodies. Their initial
orientation remains fixed throughout a run; tracking the target would conceal
bearing changes in miss cases. Positions represent point centres, and visual
body sizes are illustrative. End a run at centre contact, the first ground
event, or a finite observation horizon for a miss. Ground-contact equality is
classified separately from an airborne meeting.

Presets are selected from a dropdown. The monkey always releases its hold,
with an optional delay. In the 2D view, both velocity vectors use the same
scale (0.18 seconds of displacement per vector). The initial velocity remains
at the launcher and its explicit drag handle changes speed and aim; other
canvas areas retain native scrolling and pinch zoom. The handle also accepts
arrow keys (up/down for speed, left/right for angle).

The 2D field is fixed at x = -2..40 m and y = -4..28 m, independently of all
parameters, time, and display toggles. Resizing preserves equal x/y units.
Extreme trajectories and no-gravity comparison positions can leave this field
without changing its scale. Strobes mark both bodies every 0.2 seconds and join
equal-time positions, preserving any miss or release-delay difference. The 3D
background switch hides scenery and fog, not lighting or camera attitude.
Display settings can be expanded below the primary controls.

## Checks

```powershell
node tools/test-monkey-hunting.js
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-ci.ps1
```

## Rebuild the browser bundle

Run these commands from the repository root, with Node.js and npm on PATH:

```powershell
npm.cmd install --prefix .tmp/monkey-build --no-audit --no-fund three@0.180.0 lucide@0.468.0 esbuild@0.25.10
node tools/build-monkey-assets.js
```

The build uses Three.js and Lucide under their respective MIT and ISC licenses.
It does not load external resources at runtime.
