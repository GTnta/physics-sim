import * as THREE from 'three';
import { createIcons, ArrowLeft, Play, Pause, RotateCcw, Crosshair, SkipBack, SkipForward } from 'lucide';

const icons = { ArrowLeft, Play, Pause, RotateCcw, Crosshair, SkipBack, SkipForward };
window.MonkeyIcons = () => createIcons({ icons });

function material(color) { return new THREE.MeshStandardMaterial({ color, roughness: .84 }); }

function sphere(parent, geometry, mat, x, y, z, sx, sy = sx, sz = sx) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}

function makeMonkey() {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const fur = material('#947363');
  const skin = material('#eed5b4');
  const dark = material('#253a3c');
  const vest = material('#27846e');
  sphere(group, geo, fur, 0, -.12, 0, .32, .4, .25);
  sphere(group, geo, vest, 0, -.13, .06, .30, .29, .24);
  sphere(group, geo, fur, 0, .37, 0, .37, .34, .29);
  sphere(group, geo, skin, 0, .33, .205, .28, .24, .11);
  for (const side of [-1, 1]) {
    sphere(group, geo, fur, side * .36, .37, 0, .14);
    sphere(group, geo, skin, side * .37, .37, .09, .085);
    sphere(group, geo, dark, side * .105, .40, .303, .032, .045, .022);
    sphere(group, geo, fur, side * .37, -.09, 0, .13, .31, .13);
    sphere(group, geo, skin, side * .4, -.35, .04, .105);
    sphere(group, geo, fur, side * .15, -.48, 0, .115, .25, .12);
    sphere(group, geo, skin, side * .16, -.65, .08, .13, .085, .16);
  }
  sphere(group, geo, dark, 0, .27, .318, .043, .026, .025);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -.3, -.2), new THREE.Vector3(.4, -.5, -.35),
    new THREE.Vector3(.65, -.25, -.35), new THREE.Vector3(.55, 0, -.3)
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 18, .055, 7, false), fur));
  group.rotation.y = -Math.PI / 2;
  return group;
}

function makeBall() {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.32, 28, 20), material('#dc6662'));
  group.add(ball);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(.321, .014, 5, 48), material('#fff6e8'));
  group.add(seam);
  const second = seam.clone();
  second.rotation.y = Math.PI / 2;
  group.add(second);
  return group;
}

function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef6f7');
  scene.fog = new THREE.Fog('#eef6f7', 55, 140);
  scene.add(new THREE.HemisphereLight('#ffffff', '#adc0ad', 2.3));
  const sun = new THREE.DirectionalLight('#fff7e8', 2.6);
  sun.position.set(-10, 30, 18);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), material('#e0ebe1'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.02;
  scene.add(floor);
  const grid = new THREE.GridHelper(160, 32, '#a3b6b0', '#c5d6cb');
  grid.position.y = -.008;
  scene.add(grid);
  const ball = makeBall();
  const monkey = makeMonkey();
  scene.add(ball, monkey);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.24, .36, 1, 12), material('#8f8475'));
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 3.4, 10), material('#8f8475'));
  branch.rotation.z = Math.PI / 2;
  const foliage = new THREE.Group();
  const leafGeo = new THREE.SphereGeometry(1, 14, 10);
  const leafMat = material('#78a58a');
  sphere(foliage, leafGeo, leafMat, -.8, 0, 0, 1.6, 1.1, 1.5);
  sphere(foliage, leafGeo, material('#9cbaa0'), .8, .4, .3, 1.8, 1.2, 1.6);
  scene.add(trunk, branch, foliage);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(.44, .55, 1, 20), material('#8dacad'));
  scene.add(platform);
  return { scene, ball, monkey, trunk, branch, foliage, platform };
}

window.MonkeyScene = class MonkeyScene {
  constructor(monkeyCanvas, ballCanvas) {
    this.world = makeScene();
    this.views = [monkeyCanvas, ballCanvas].map(canvas => {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const camera = new THREE.PerspectiveCamera(43, 1, .035, 180);
      return { renderer, camera, canvas };
    });
    this.healthy = true;
    for (const { canvas } of this.views) {
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        this.healthy = false;
        document.getElementById('webglError').hidden = false;
      });
      canvas.addEventListener('webglcontextrestored', () => {
        this.healthy = true;
        document.getElementById('webglError').hidden = true;
        window.dispatchEvent(new Event('resize'));
      });
    }
  }

  configure(plan) {
    const p = plan.params;
    const w = this.world;
    w.trunk.scale.y = p.height + 1.9;
    w.trunk.position.set(p.distance + 1.3, (p.height + 1.9) / 2, 0);
    w.branch.position.set(p.distance + .5, p.height + 1.0, 0);
    w.foliage.position.set(p.distance + 1.3, p.height + 2.0, 0);
    w.platform.scale.y = p.launchHeight - .38;
    w.platform.position.set(0, (p.launchHeight - .38) / 2, 0);
    // Fixed initial attitude: following the target every frame would hide misses.
    this.views[0].camera.position.set(p.distance, p.height, 0);
    this.views[0].camera.lookAt(0, p.launchHeight, 0);
    this.views[1].camera.position.set(0, p.launchHeight, 0);
    this.views[1].camera.lookAt(p.distance, p.height, 0);
  }

  render(sample) {
    if (!this.healthy) return;
    const w = this.world;
    w.ball.position.set(sample.ball.x, sample.ball.y, 0);
    w.monkey.position.set(sample.monkey.x, sample.monkey.y, 0);
    for (let i = 0; i < this.views.length; i += 1) {
      const { renderer, camera, canvas } = this.views[i];
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const from = i === 0 ? sample.monkey : sample.ball;
      camera.position.set(from.x, from.y, 0);
      w.monkey.visible = i === 1 && sample.separation > .04;
      w.ball.visible = i === 0 && sample.separation > .04;
      renderer.render(w.scene, camera);
    }
  }
};
