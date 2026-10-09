import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { envelope } from './analysis.js';
const colors = { clear: 0x4bc7a1, review: 0xffc06b, clash: 0xff697d };
export function createViewer(container, onSelect) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch { container.innerHTML = '<div class="webgl-error">3D needs a browser with WebGL enabled. Crossing analysis and CSV export remain available.</div>'; return { update() {}, fit() {}, top() {}, focus() {}, exaggerate() {}, showMarkers() {} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x101d30);
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D conduit network. Drag to orbit, scroll to zoom, right drag to pan.');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .01, 100000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xdceeff, 3); light.position.set(40, 100, 60); scene.add(light);
  let group = new THREE.Group(), crossingOverlays = new THREE.Group(), markersVisible = true; scene.add(group);
  let origin = [0, 0], base = 0, extent = 100, spanX = 100, spanY = 100, minZ = 0, maxZ = 0, exaggeration = 1, pipes = [], crossings = [], markers = [], selection;
  function disposeGroup() {
    group.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    scene.remove(group); group = new THREE.Group(); scene.add(group); markers = [];
  }
  function position(point, z) { return new THREE.Vector3(point[0] - origin[0], (z - base) * exaggeration, -(point[1] - origin[1])); }
  function draw() {
    disposeGroup();
    const grid = new THREE.GridHelper(extent * 1.7, 20, 0x30425b, 0x1e3047); grid.position.y = -2; group.add(grid);
    for (const p of pipes) {
      const color = p.id.startsWith('SAN') ? 0x60bbb7 : 0x719cfa;
      for (let i = 0; i < p.points.length - 1; i++) {
        const a = position(p.points[i], envelope(p, p.distances[i]).center), b = position(p.points[i + 1], envelope(p, p.distances[i + 1]).center);
        const direction = b.clone().sub(a), length = direction.length(); if (!length) continue;
        // Elliptic tubes/boxes preserve the specified vertical envelope, including vertical exaggeration.
        const h = p.height + 2 * p.wall, w = p.width + 2 * p.wall;
        const geometry = p.shape === 'rectangular' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(1, 1, 1, 18);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .12 }));
        // A basis with vertical cross sections matches the analysis's invert + height convention.
        const planar = new THREE.Vector3(direction.x, 0, direction.z).normalize();
        const side = new THREE.Vector3(-planar.z, 0, planar.x).multiplyScalar(w / (p.shape === 'rectangular' ? 1 : 2));
        const along = direction.clone();
        const vertical = new THREE.Vector3(0, h * exaggeration / (p.shape === 'rectangular' ? 1 : 2), 0);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.makeBasis(side, along, vertical); mesh.matrix.setPosition(a.clone().add(b).multiplyScalar(.5));
        group.add(mesh);
      }
    }
    crossingOverlays = new THREE.Group(); crossingOverlays.visible = markersVisible; group.add(crossingOverlays);
    for (const c of crossings) {
      const z = (Math.max(c.ea.top, c.eb.top) + Math.min(c.ea.bottom, c.eb.bottom)) / 2;
      const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(extent * .008, .5), 16, 12), new THREE.MeshBasicMaterial({ color: colors[c.status], transparent: true, opacity: .3, depthTest: false, depthWrite: false }));
      marker.position.copy(position(c.point, z)); marker.userData.id = c.id; marker.renderOrder = 5; crossingOverlays.add(marker); markers.push(marker);
      if (selection === c.id) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(extent * .018, extent * .002, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
        ring.position.copy(marker.position); ring.rotation.x = Math.PI / 2; ring.renderOrder = 6; crossingOverlays.add(ring);
      }
    }
  }
  function fitDistance() {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const radius = Math.hypot(spanX / 2, spanY / 2, (maxZ - minZ) * exaggeration / 2);
    return Math.max(10, radius * 1.12 / Math.sin(Math.min(verticalFov, horizontalFov) / 2));
  }
  function fit() {
    const target = new THREE.Vector3(0, ((maxZ + minZ) / 2 - base) * exaggeration, 0);
    controls.target.copy(target);
    camera.position.copy(new THREE.Vector3(.82, .7, .98).normalize().multiplyScalar(fitDistance()).add(target));
    camera.near = Math.max(.001, extent / 10000); camera.far = Math.max(1000, fitDistance() * 100); camera.updateProjectionMatrix(); controls.update();
  }
  const observer = new ResizeObserver(() => { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }); observer.observe(container);
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(); let pointerDown;
  renderer.domElement.addEventListener('pointerdown', e => { pointerDown = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!markersVisible || !pointerDown || Math.hypot(e.clientX - pointerDown[0], e.clientY - pointerDown[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(mouse, camera); const hit = raycaster.intersectObjects(markers)[0]; if (hit) onSelect(hit.object.userData.id);
  });
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  return {
    update(nextPipes, nextCrossings) {
      pipes = nextPipes; crossings = nextCrossings; selection = undefined;
      if (pipes.length) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; minZ = Infinity; maxZ = -Infinity;
        for (const pipe of pipes) {
          minZ = Math.min(minZ, envelope(pipe, 0).bottom, envelope(pipe, pipe.length).bottom);
          maxZ = Math.max(maxZ, envelope(pipe, 0).top, envelope(pipe, pipe.length).top);
          for (const [x, y] of pipe.points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        }
        origin = [(minX + maxX) / 2, (minY + maxY) / 2]; base = minZ - 1;
        spanX = maxX - minX; spanY = maxY - minY; extent = Math.max(spanX, spanY, 10);
      }
      draw(); fit();
    },
    fit,
    top() { camera.position.set(controls.target.x, controls.target.y + fitDistance(), controls.target.z + .001); controls.update(); },
    focus(id) {
      const c = crossings.find(c => c.id === id); if (!c) return;
      selection = id; draw();
      const target = position(c.point, (c.ea.center + c.eb.center) / 2), offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(Math.max(extent * .22, 8));
      controls.target.copy(target); camera.position.copy(target.clone().add(offset)); controls.update();
    },
    showMarkers(visible) { markersVisible = Boolean(visible); crossingOverlays.visible = markersVisible; },
    exaggerate(value) { exaggeration = value; draw(); }
  };
}
