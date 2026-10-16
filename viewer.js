import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODELS } from './models.js';

const EMPTY_TEXT = {
  cars: 'Cars will be added here.',
  designs: 'CAD models and design drawings will be added here.'
};

const loader = new STLLoader();
const geometryCache = new Map();

function getGeometry(file) {
  if (!geometryCache.has(file)) {
    geometryCache.set(file, new Promise((resolve, reject) => {
      loader.load(file, (geo) => {
        geo.computeBoundingBox();
        geo.center();
        const size = new THREE.Vector3();
        geo.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        resolve({ geo, scale: 2 / maxDim });
      }, undefined, () => reject(new Error('Could not load ' + file)));
    }));
  }
  return geometryCache.get(file);
}

function showMessage(box, text) {
  let msg = box.querySelector('.viewer-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'viewer-msg';
    box.appendChild(msg);
  }
  msg.textContent = text;
}

function clearMessage(box) {
  const msg = box.querySelector('.viewer-msg');
  if (msg) msg.remove();
}

function start(v) {
  if (v.active) return;
  v.active = true;
  const box = v.box;
  showMessage(box, 'Loading model...');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(box.clientWidth, box.clientHeight);
  box.insertBefore(renderer.domElement, box.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, box.clientWidth / box.clientHeight, 0.1, 100);
  camera.position.set(2.4, 1.5, 3);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 8;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  getGeometry(v.model.file).then(({ geo, scale }) => {
    if (!v.active) return;
    const material = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.35, roughness: 0.45 });
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.setScalar(scale);
    if (v.model.up === 'z') mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    clearMessage(box);
  }).catch((err) => {
    showMessage(box, err.message);
  });

  let frame = 0;
  function animate() {
    frame = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(box);

  v.dispose = () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    v.active = false;
  };
}

function stop(v) {
  if (v.active && v.dispose) v.dispose();
}

function makeCard(model) {
  const card = document.createElement('article');
  card.className = 'card';

  const box = document.createElement('div');
  box.className = 'viewer';
  const hint = document.createElement('div');
  hint.className = 'viewer-hint';
  hint.textContent = 'Drag to rotate, scroll to zoom';
  box.appendChild(hint);
  card.appendChild(box);

  if (model.tag) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = model.tag;
    card.appendChild(tag);
  }
  const title = document.createElement('h3');
  title.textContent = model.title || model.file;
  card.appendChild(title);
  if (model.description) {
    const p = document.createElement('p');
    p.textContent = model.description;
    card.appendChild(p);
  }
  const link = document.createElement('a');
  link.className = 'more';
  link.href = model.file;
  link.setAttribute('download', '');
  link.textContent = 'Download STL';
  card.appendChild(link);

  return { card, box };
}

function render() {
  const viewers = [];
  for (const section of Object.keys(EMPTY_TEXT)) {
    const host = document.getElementById(section + '-list');
    if (!host) continue;
    const items = MODELS.filter((m) => m.section === section);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = EMPTY_TEXT[section];
      host.appendChild(empty);
      continue;
    }
    const grid = document.createElement('div');
    grid.className = 'list-grid';
    for (const model of items) {
      const { card, box } = makeCard(model);
      grid.appendChild(card);
      viewers.push({ box, model, active: false, dispose: null });
    }
    host.appendChild(grid);
  }

  if (viewers.length === 0) return;
  const byBox = new Map(viewers.map((v) => [v.box, v]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const v = byBox.get(entry.target);
      if (entry.isIntersecting) start(v);
      else stop(v);
    }
  }, { rootMargin: '200px' });
  viewers.forEach((v) => observer.observe(v.box));
}

render();
