import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dayKey, addStamp, streak, skyAt, planPath, blockedStep } from './logic.js';

const $ = (id) => document.getElementById(id);

// 브라우저 저장소는 막혀 있을 수 있다(사생활 보호 창 등) — 실패해도 화면은 돈다
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 안 됨 */ } },
};

// ---------- 기본 장면 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ec8e4, 60, 140);
// 세로 화면(휴대폰)은 좌우가 좁아 보이니 시야각을 넓힌다
const fovFor = (aspect) => (aspect < 1 ? 72 : 50);
const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enablePan: false, enableDamping: true, dampingFactor: 0.08,
  minDistance: 5, maxDistance: 34, minPolarAngle: 0.35, maxPolarAngle: 1.38,
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x8f8473, 1.0);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

// ---------- 만드는 도구 ----------
const C = {
  wall: '#efe9df', stone: '#d6d0c4', carpet: '#b7c0c2', tile: '#e8dfcf', corridor: '#ddd6ca',
  wood: '#b28c64', dark: '#2f3238', metal: '#9aa0a6', chair: '#4a5260', accent: '#e07a3f',
  leaf: '#6f8f5a', pot: '#c9b9a3', grass: '#93a08a', walk: '#cfc9bd', concrete: '#a9a49b',
};
const matCache = new Map();
function mat(color, opts) {
  if (color instanceof THREE.Material) return color;
  if (opts) return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  return matCache.get(color);
}
function add(mesh, x, y, z, parent = scene) {
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const box = (w, h, d, c, x, y, z, p, o) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)), x, y, z, p);
const cyl = (rt, rb, h, c, x, y, z, p, seg = 20) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), x, y, z, p);
const glass = new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });

// 캔버스에 글자를 그려 판으로 붙인다(외부 글꼴·이미지 없음)
function canvasPlane(w, h, draw, px = 512) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round((px * h) / w);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.redraw = (...args) => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height, ...args); tex.needsUpdate = true; };
  mesh.redraw();
  return mesh;
}
const FONT = "'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
function sign(text, w, h, { bg = '#fbf8f2', fg = C.dark, size = 0.55 } = {}) {
  return canvasPlane(w, h, (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.fillStyle = fg; g.font = `700 ${Math.round(H * size)}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + H * 0.03);
  });
}
function logoSign(w, h) {
  return canvasPlane(w, h, (g, W, H) => {
    g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, W, H);
    g.font = `800 ${Math.round(H * 0.55)}px ${FONT}`; g.textBaseline = 'middle';
    const a = '쉼표', b = ',', c = '(주)';
    const wa = g.measureText(a).width, wb = g.measureText(b).width, wc = g.measureText(c).width;
    let x = (W - wa - wb - wc) / 2;
    g.fillStyle = C.dark; g.fillText(a, x, H / 2); x += wa;
    g.fillStyle = C.accent; g.fillText(b, x, H / 2); x += wb;
    g.fillStyle = C.dark; g.fillText(c, x, H / 2);
  });
}
function plant(x, z, s = 1, parent = scene, y = 0) {
  cyl(0.28 * s, 0.22 * s, 0.5 * s, C.pot, x, y + 0.25 * s, z, parent);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 * s, 0), new THREE.MeshStandardMaterial({ color: C.leaf, flatShading: true, roughness: 0.9 }));
  add(leaves, x, y + 0.95 * s, z, parent);
}

// ---------- 클릭할 수 있는 것 ----------
const walkables = []; // 바닥
const actionMeshes = []; // 눌러서 뭔가 하는 물건
function floor(w, d, color, x, z, y = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  walkables.push(m);
  return m;
}
// action: { name, at: Vector3 (서서 누를 자리), run() }
function actionable(action, ...meshes) {
  for (const m of meshes) { m.userData.action = action; actionMeshes.push(m); }
  return action;
}

// ---------- 1층 ----------
// 건물: x -20~20, z -14~12. 정문 z=12, 출근 게이트 z=7(둘 다 가운데 |x|<=2 로만 지난다 — logic.js planPath)
floor(260, 260, C.grass, 0, 0, -0.02);
floor(48, 10, C.walk, 0, 17, -0.01);
floor(40, 5, C.stone, 0, 9.5); // 로비
floor(17, 21, C.carpet, -11.5, -3.5); // 사무실
floor(6, 21, C.corridor, 0, -3.5); // 복도
floor(17, 21, C.tile, 11.5, -3.5); // 탕비실

// 벽: 앞(남쪽)은 유리라 안이 보인다. 높이를 낮춰 카메라를 돌려도 안이 덜 가린다
box(40.4, 2.6, 0.3, C.wall, 0, 1.3, -14.15);
box(0.3, 2.6, 26.6, C.wall, -20.15, 1.3, -1);
box(0.3, 2.6, 26.6, C.wall, 20.15, 1.3, -1);
// 정문 틀·간판: 안에 들어가면 카메라를 가리니 흐려진다(frame 에서 opacity)
const entranceMat = new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.85, transparent: true });
for (const sx of [-1, 1]) {
  const m = box(17.6, 2.6, 0.12, glass, sx * 11.2, 1.3, 12);
  m.castShadow = false;
  box(0.3, 2.8, 0.3, entranceMat, sx * 2.4, 1.4, 12); // 문틀
}
box(5.1, 0.3, 0.3, entranceMat, 0, 2.75, 12);
const logo = logoSign(6, 1.2);
logo.position.set(0, 3.6, 12.2);
scene.add(logo);
box(6.4, 1.4, 0.15, entranceMat, 0, 3.6, 12.05);

// 북쪽 창 — 하늘색을 따라간다
const windowMat = new THREE.MeshBasicMaterial({ color: '#9ec8e4' });
for (let i = -3; i <= 3; i++) {
  if (i === 0) continue;
  const w = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), windowMat);
  w.position.set(i * 5.5, 1.65, -13.99);
  scene.add(w);
}

// 로비: 안내 데스크, 화분, 유리 칸막이
box(4, 1.05, 1, C.wood, -9, 0.525, 9.6);
box(4.2, 0.06, 1.2, '#f4f0e8', -9, 1.08, 9.6);
const recep = sign('안내', 1.2, 0.4);
recep.position.set(-9, 0.7, 10.11);
scene.add(recep);
plant(-17.5, 10.5, 1.3);
plant(17.5, 10.5, 1.3);
plant(6.5, 10.8, 1);
for (const sx of [-1, 1]) {
  const g = box(17.2, 1.2, 0.08, glass, sx * 11.25, 0.6, 7);
  g.castShadow = false;
  box(17.2, 0.06, 0.12, C.metal, sx * 11.25, 1.22, 7);
}

// 출근 게이트: 양쪽 받침 + 가운데로 닫히는 유리문 2장 + 카드 리더기
const flaps = [];
const flapMat = new THREE.MeshStandardMaterial({ color: C.accent, transparent: true, opacity: 0.45, roughness: 0.2 });
for (const sx of [-1, 1]) {
  box(0.35, 1.05, 1.4, '#dcdad5', sx * 2.45, 0.525, 7);
  box(0.37, 0.05, 1.42, C.dark, sx * 2.45, 1.07, 7);
  const pivot = new THREE.Group();
  pivot.position.set(sx * 2.27, 0.75, 7);
  scene.add(pivot);
  const f = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.04), flapMat);
  f.position.x = -sx * 1.1;
  pivot.add(f);
  pivot.userData.side = sx;
  flaps.push(pivot);
}
const readerBody = box(0.3, 0.42, 0.12, C.dark, 2.45, 1.3, 7.62);
readerBody.rotation.x = -0.35;
const readerLight = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ color: C.accent }));
readerLight.position.set(2.45, 1.33, 7.7);
readerLight.rotation.x = -0.35;
scene.add(readerLight);
const gateSign = sign('사원증을 대 주세요', 2.4, 0.4, { size: 0.5 });
gateSign.position.set(0, 2.15, 7);
scene.add(gateSign);
box(5.3, 0.5, 0.1, C.dark, 0, 2.15, 6.94);

// 사무실 책상들
function desk(x, z, mine) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  box(1.8, 0.06, 0.9, C.wood, 0, 0.75, 0, g);
  for (const sx of [-1, 1]) box(0.05, 0.75, 0.8, C.metal, sx * 0.85, 0.375, 0, g);
  box(1.95, 1.25, 0.05, '#c7cfcc', 0, 0.625, -0.5, g); // 칸막이
  box(0.08, 0.32, 0.08, C.dark, 0, 0.94, -0.2, g);
  box(0.92, 0.54, 0.04, C.dark, 0, 1.32, -0.2, g);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.46), new THREE.MeshBasicMaterial({ color: '#15171c' }));
  screen.position.set(0, 1.32, -0.177);
  g.add(screen);
  box(0.5, 0.02, 0.16, '#d9d9d9', 0, 0.79, 0.15, g);
  box(0.52, 0.08, 0.5, C.chair, 0, 0.48, 0.75, g);
  box(0.52, 0.62, 0.06, C.chair, 0, 0.85, 1.0, g);
  cyl(0.04, 0.04, 0.44, C.dark, 0, 0.22, 0.75, g, 8);
  if (!mine && Math.random() < 0.5) cyl(0.06, 0.05, 0.12, '#f4f1ea', 0.6, 0.84, 0.1, g, 12); // 머그
  return { g, screen };
}
const deskXs = [-16.5, -12, -7.5];
const deskZs = [-9.5, -4, 1.5];
let myDesk;
for (const x of deskXs) for (const z of deskZs) {
  const mine = x === -7.5 && z === 1.5;
  const d = desk(x, z, mine);
  if (mine) myDesk = d;
}
plant(-19, -13, 1.2);
plant(-3.8, -13, 1);
plant(-19, 5.8, 1);

// 내 자리: 이름표, 모니터(켜고 끄기), 포스트잇(할 일)
const nameTag = sign('내 자리', 1.0, 0.3, { bg: C.accent, fg: '#fff' });
nameTag.position.set(0, 1.42, -0.47);
myDesk.g.add(nameTag);

const screenOn = canvasPlane(0.84, 0.46, (g, W, H) => {
  g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3a6ea5'; g.fillRect(0, 0, W, H * 0.12);
  g.fillStyle = '#fff'; g.font = `600 ${Math.round(H * 0.07)}px ${FONT}`; g.textBaseline = 'middle';
  g.fillText('자기소개서_최종_진짜최종.hwp', W * 0.03, H * 0.06);
  g.fillStyle = '#c9c9c4';
  for (let i = 0; i < 7; i++) g.fillRect(W * 0.1, H * (0.24 + i * 0.1), W * (i % 3 === 2 ? 0.5 : 0.8), H * 0.035);
});
screenOn.position.copy(myDesk.screen.position);
screenOn.position.z += 0.002;
screenOn.visible = store.get('comma.monitor', false);
myDesk.g.add(screenOn);

const postit = canvasPlane(0.42, 0.42, (g, W, H, text = '') => {
  g.fillStyle = '#ffe680'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5a4a1a'; g.font = `600 ${Math.round(H * 0.11)}px ${FONT}`; g.textBaseline = 'top';
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (!lines.length) { g.globalAlpha = 0.55; g.fillText('할 일 적기', W * 0.08, H * 0.1); g.globalAlpha = 1; }
  lines.forEach((s, i) => g.fillText(s.length > 9 ? s.slice(0, 9) + '…' : s, W * 0.08, H * (0.1 + i * 0.2)));
}, 256);
postit.position.set(-0.62, 1.02, -0.47);
postit.rotation.z = 0.06;
myDesk.g.add(postit);
postit.redraw(store.get('comma.todo', ''));

// 복도 끝 엘리베이터(옥상)
box(4.2, 3.2, 2.4, '#d6d0c5', 0, 1.6, -12.8);
const doorL = box(0.95, 2.3, 0.06, '#b9bec4', -0.49, 1.15, -11.57, undefined, { metalness: 0.4, roughness: 0.35 });
const doorR = box(0.95, 2.3, 0.06, '#b9bec4', 0.49, 1.15, -11.57, undefined, { metalness: 0.4, roughness: 0.35 });
const liftSign = sign('옥상 ↑', 1.4, 0.4, { bg: C.dark, fg: '#fff' });
liftSign.position.set(0, 2.65, -11.55);
scene.add(liftSign);

// 탕비실
const pantrySign = sign('탕비실', 1.6, 0.5);
pantrySign.position.set(19.98, 2.0, -5);
pantrySign.rotation.y = -Math.PI / 2;
scene.add(pantrySign);
box(1.2, 0.95, 10, '#e9e4da', 19.3, 0.475, -7.5);
box(1.3, 0.05, 10.1, '#8f8778', 19.3, 0.97, -7.5);
box(0.6, 1.0, 10, '#e9e4da', 19.65, 2.0, -7.5); // 위 수납장
const coffee = new THREE.Group();
coffee.position.set(19.2, 1.0, -9.5);
scene.add(coffee);
box(0.6, 0.75, 0.55, C.dark, 0, 0.375, 0, coffee);
box(0.26, 0.03, 0.32, '#555', -0.43, 0.015, 0, coffee); // 받침(기계 앞)
const coffeeBtn = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: C.accent }));
coffeeBtn.position.set(-0.31, 0.6, 0);
coffeeBtn.rotation.y = -Math.PI / 2;
coffee.add(coffeeBtn);
const cup = new THREE.Group();
cup.position.set(-0.43, 0.03, 0); // 기계 몸통(x -0.3~0.3) 밖에 둬야 보인다
cup.visible = false;
coffee.add(cup);
const cupShell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.15, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#fff', side: THREE.DoubleSide }));
cupShell.position.y = 0.075;
cup.add(cupShell);
const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.055, 0.13, 16), new THREE.MeshStandardMaterial({ color: '#3b2416' }));
liquid.geometry.translate(0, 0.065, 0);
cup.add(liquid);
const shelf = new THREE.Group();
shelf.position.set(19.3, 1.0, -4);
scene.add(shelf);
const snackColors = ['#d9534f', '#f0ad4e', '#5bc0de', '#8fbf6a', '#c07acb'];
for (let i = 0; i < 10; i++) box(0.22, 0.28, 0.16, snackColors[i % 5], -0.1, 0.14, -0.9 + i * 0.2, shelf);
const fridge = box(1.0, 2.0, 1.0, '#e4e6e8', 19.4, 1.0, -13.3, undefined, { metalness: 0.2, roughness: 0.4 });
for (const [tx, tz] of [[11, -9], [11, -2.5], [6.5, -6]]) {
  cyl(0.8, 0.8, 0.05, C.wood, tx, 0.74, tz);
  cyl(0.06, 0.06, 0.72, C.dark, tx, 0.36, tz, undefined, 8);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    cyl(0.22, 0.22, 0.05, C.accent, tx + Math.cos(a) * 1.1, 0.45, tz + Math.sin(a) * 1.1);
    cyl(0.03, 0.03, 0.43, C.dark, tx + Math.cos(a) * 1.1, 0.215, tz + Math.sin(a) * 1.1, undefined, 6);
  }
}
plant(4, -13, 1.1);
plant(17.8, 5.6, 1.2);

// 사무실·탕비실 경계에 낮은 화분 줄(벽 대신)
for (let z = -9; z <= 4; z += 2.6) { box(0.5, 0.45, 2.2, C.pot, -3.3, 0.225, z); box(0.5, 0.45, 2.2, C.pot, 3.3, 0.225, z); }
for (let z = -9; z <= 4; z += 2.6) for (const sx of [-1, 1]) {
  const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: C.leaf, flatShading: true }));
  add(l, sx * 3.3, 0.68, z);
}

// ---------- 옥상 ----------
// 건물 위가 아니라 멀리 떨어진 높은 자리에 따로 만든다(엘리베이터로 순간 이동). 1층 실내를 가리지 않으려고.
// 둘레 도시(반경 최대 124)가 1층 건물(z -14~12)에 닿지 않게 충분히 멀리
const R = new THREE.Vector3(0, 40, -220);
const roof = new THREE.Group();
roof.position.copy(R);
scene.add(roof);
floor(26, 18, C.concrete, 0, 0, 0, roof);
box(26, 40, 18, '#7d7a74', 0, -20.05, 0, roof).receiveShadow = false; // 건물 몸통
for (const [w, d, x, z] of [[26.4, 0.3, 0, -9], [26.4, 0.3, 0, 9], [0.3, 18, -13, 0], [0.3, 18, 13, 0]]) box(w, 0.7, d, '#bdb8ae', x, 0.35, z, roof);
const deck = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mat('#a98a66'));
deck.rotation.x = -Math.PI / 2;
deck.position.set(0, 0.01, -4.5);
deck.receiveShadow = true;
roof.add(deck);
walkables.push(deck);
box(4.2, 3.0, 2.6, '#cfc9be', 0, 1.5, 7.4, roof); // 옥상 엘리베이터 칸
const roofDoorL = box(0.95, 2.3, 0.06, '#b9bec4', -0.49, 1.15, 6.07, roof, { metalness: 0.4, roughness: 0.35 });
const roofDoorR = box(0.95, 2.3, 0.06, '#b9bec4', 0.49, 1.15, 6.07, roof, { metalness: 0.4, roughness: 0.35 });
const downSign = sign('1층 ↓', 1.4, 0.4, { bg: C.dark, fg: '#fff' });
downSign.position.set(0, 2.6, 6.03);
downSign.rotation.y = Math.PI;
roof.add(downSign);
const benches = [];
for (const bx of [-4, 4]) {
  const b = new THREE.Group();
  b.position.set(bx, 0, -6.2);
  roof.add(b);
  box(2.6, 0.08, 0.7, C.wood, 0, 0.48, 0, b);
  box(2.6, 0.55, 0.08, C.wood, 0, 0.8, 0.33, b);
  for (const sx of [-1, 1]) box(0.08, 0.48, 0.6, C.dark, sx * 1.15, 0.24, 0, b);
  benches.push(b);
}
for (const [x, z] of [[-11.5, -7.5], [11.5, -7.5], [-11.5, 4], [11.5, 4], [-7.5, -7.6], [7.5, -7.6]]) plant(x, z, 1.3, roof);
// 줄 조명(밤에 켜진다)
const bulbMat = new THREE.MeshBasicMaterial({ color: '#ece8de' });
for (const sx of [-1, 1]) cyl(0.05, 0.05, 3, C.dark, sx * 7, 1.5, -1.5, roof, 6);
const wire = [];
for (let i = 0; i <= 14; i++) {
  const t = i / 14;
  const p = new THREE.Vector3(-7 + 14 * t, 3.0 - Math.sin(Math.PI * t) * 0.6, -1.5);
  wire.push(p);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat);
  b.position.copy(p).y -= 0.1;
  roof.add(b);
}
roof.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: C.dark })));
// 둘레 도시: 옥상보다 낮은 건물들. 밤엔 일부 창이 켜진다
// 창문 무늬: 밝은 칸만 밤에 빛난다(emissiveMap)
const winCanvas = document.createElement('canvas');
winCanvas.width = 64; winCanvas.height = 128;
{
  const g = winCanvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  let s = 3;
  for (let y = 6; y < 128; y += 14) for (let x = 6; x < 64; x += 14) {
    s = (s * 48271) % 2147483647;
    g.fillStyle = s % 3 ? '#fff' : '#222';
    g.fillRect(x, y, 8, 8);
  }
}
const winTex = new THREE.CanvasTexture(winCanvas);
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
winTex.repeat.set(2, 3);
const cityDay = new THREE.MeshStandardMaterial({ color: '#8d96a3', roughness: 0.9 });
const cityLit = new THREE.MeshStandardMaterial({ color: '#7f8894', roughness: 0.9, emissive: '#f2c27b', emissiveMap: winTex, emissiveIntensity: 0 });
const seeded = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
for (let i = 0; i < 140; i++) {
  const a = seeded() * Math.PI * 2;
  const r = 34 + seeded() * 90;
  const w = 5 + seeded() * 7, d = 5 + seeded() * 7, h = 14 + seeded() * 20; // 옥상(높이 42)보다 8 이상 낮게
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 3 === 2 ? cityDay : cityLit);
  m.position.set(Math.cos(a) * r, -42 + h / 2, Math.sin(a) * r);
  roof.add(m);
}
const ground2 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#6c7466'));
ground2.rotation.x = -Math.PI / 2;
ground2.position.y = -42;
roof.add(ground2);
// 해·달·별
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffe9b0', fog: false }));
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: '#e8ecf5', fog: false }));
roof.add(sunDisc, moonDisc);
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 500; i++) {
  const a = seeded() * Math.PI * 2, e = 0.15 + seeded() * 1.3, r = 180;
  starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false }));
roof.add(stars);

// ---------- 나(아바타) ----------
function makePerson() {
  const g = new THREE.Group();
  const skin = mat('#f1c7a5'), shirt = mat('#f4f4f2'), pants = mat('#3d4552');
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.12, 0.82, 0);
    g.add(hip);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.2), pants), 0, -0.41, 0, hip);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.28), mat('#2a2a2a')), 0, -0.8, 0.04, hip);
    legs.push(hip);
    const sh = new THREE.Group();
    sh.position.set(sx * 0.38, 1.42, 0);
    g.add(sh);
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), shirt), 0, -0.3, 0, sh);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin), 0, -0.62, 0, sh);
    arms.push(sh);
  }
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 12), shirt), 0, 1.18, 0, g);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.02), mat(C.accent)), 0, 1.26, 0.3, g);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), skin), 0, 1.8, 0, g);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.275, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#2d2420')), 0, 1.83, -0.01, g);
  for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#222')), sx * 0.09, 1.82, 0.24, g);
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: C.accent, emissiveIntensity: 0 }));
  add(card, 0.14, 0.98, 0.31, g);
  g.userData = { legs, arms, card };
  return g;
}
const me = makePerson();
const START = new THREE.Vector3(0, 0, 19);
me.position.copy(START);
me.rotation.y = Math.PI;
scene.add(me);
camera.position.set(0, 9, 30);
controls.target.set(0, 1.2, 19);

// ---------- 상태 ----------
const today = () => dayKey(new Date());
let stamps = store.get('comma.stamps', []);
const stampedToday = () => stamps.includes(today());
let path = [];
let pending = null; // 도착하면 할 일
let sitting = false;
let busy = false; // 순간 이동 중

function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

function refreshHud() {
  const n = streak(stamps, today());
  $('stamp-btn').textContent = stampedToday() ? `출근 ${n}일째` : '출근 전';
  me.userData.card.material.emissiveIntensity = stampedToday() ? 0.6 : 0;
  readerLight.material.color.set(stampedToday() ? '#5cb85c' : C.accent);
}

function placeName() {
  const p = me.position;
  if (p.y > 20) return '옥상';
  if (p.z > 12) return '회사 앞';
  if (p.z > 7) return '로비';
  if (p.x < -3) return p.distanceTo(myDesk.g.position) < 3 ? '내 자리' : '사무실';
  if (p.x > 3) return '탕비실';
  return '복도';
}

// ---------- 동작 ----------
const onRoof = () => me.position.y > 20;
const local = (x, z) => new THREE.Vector3(x, 0, z);
const roofPt = (x, z) => new THREE.Vector3(R.x + x, R.y, R.z + z);

actionable({
  name: '사원증 찍기',
  at: local(1.6, 8.3),
  run() {
    if (stampedToday()) { toast('오늘은 이미 출근했어요. 들어가세요.'); return; }
    stamps = addStamp(stamps, today());
    store.set('comma.stamps', stamps);
    const fx = $('stamp-fx');
    fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
    refreshHud();
    toast(`출근 도장 쾅. 연속 ${streak(stamps, today())}일째예요.`);
  },
}, readerBody, readerLight, gateSign);

actionable({
  name: '모니터 켜고 끄기',
  at: local(-7.5, 2.9),
  run() {
    screenOn.visible = !screenOn.visible;
    store.set('comma.monitor', screenOn.visible);
    toast(screenOn.visible ? '자기소개서가 열려 있네요. 오늘은 한 줄만 고쳐도 충분해요.' : '모니터를 껐어요. 잠깐 쉬어요.');
  },
}, myDesk.screen, screenOn);

actionable({
  name: '포스트잇에 할 일 적기',
  at: local(-8.3, 2.9), // 모니터(-7.5)보다 왼쪽: 키보드로 가까이 간 쪽이 골라진다
  run() {
    const ta = document.createElement('textarea');
    ta.value = store.get('comma.todo', '');
    ta.placeholder = '예) 이력서 한 줄 고치기\n공고 하나만 읽기\n산책 10분';
    ta.maxLength = 300;
    openPanel('포스트잇', ta, () => {
      store.set('comma.todo', ta.value);
      postit.redraw(ta.value);
    });
  },
}, postit);

let brewing = 0;
actionable({
  name: '커피 내리기',
  at: local(18.0, -9.5),
  run() {
    if (brewing) return;
    const c = store.get('comma.coffee', { day: '', n: 0 });
    const n = c.day === today() ? c.n + 1 : 1;
    store.set('comma.coffee', { day: today(), n });
    cup.visible = true;
    liquid.scale.y = 0.01;
    brewing = 2.4;
    toast(n === 1 ? '아메리카노 한 잔 내리는 중이에요.' : `오늘 ${n}잔째예요. 물도 한 잔 마셔요.`);
  },
}, ...coffee.children.filter((m) => m.isMesh));

const snacks = ['초코파이', '바나나우유', '에너지바', '귤', '맛동산', '견과류 한 봉'];
actionable({
  name: '간식 고르기',
  at: local(18.0, -4),
  run() { toast(`${snacks[Math.floor(Math.random() * snacks.length)]} 하나 챙겼어요.`); },
}, ...shelf.children);

actionable({ name: '시원한 물 꺼내기', at: local(18.3, -12.2), run() { toast('냉장고에서 물 한 병 꺼냈어요.'); } }, fridge);

actionable({
  name: '엘리베이터 타고 옥상으로',
  at: local(0, -10.6),
  run() { teleport(roofPt(0, 4.8), Math.PI, '옥상에 올라왔어요. 하늘 한 번 봐요.'); },
}, doorL, doorR, liftSign);

actionable({
  name: '엘리베이터 타고 1층으로',
  at: roofPt(0, 5.2),
  run() { teleport(local(0, -10.2), 0, '1층으로 내려왔어요.'); },
}, roofDoorL, roofDoorR, downSign);

for (const b of benches) {
  actionable({
    name: '벤치에 앉기',
    at: roofPt(b.position.x, b.position.z - 0.9),
    run() {
      sitting = true;
      me.position.set(R.x + b.position.x, R.y - 0.3, R.z + b.position.z - 0.15); // 엉덩이를 의자 높이로
      me.rotation.y = Math.PI;
      const s = skyAt(hourNow());
      const msg = { 낮: '햇볕이 좋아요. 잠깐 눈 감아 봐요.', 아침: '아침 공기가 맑아요.', 새벽: '해가 뜨려나 봐요. 일찍 일어났네요.', 노을: '노을이 지고 있어요. 오늘도 수고했어요.', 밤: '밤이에요. 별이 떠 있어요. 오늘은 여기까지.' }[s.label];
      toast(msg, 3600);
    },
  }, ...b.children);
}

function teleport(to, faceY, msg) {
  busy = true;
  sitting = false;
  path = [];
  pending = null;
  $('fade').classList.add('on');
  setTimeout(() => {
    const d = to.clone().sub(me.position);
    me.position.copy(to);
    me.rotation.y = faceY;
    controls.target.add(d);
    camera.position.add(d);
    applySky(true);
    $('fade').classList.remove('on');
    busy = false;
    toast(msg);
  }, 380);
}

// ---------- 입력: 짧게 누르면 클릭, 끌면 화면 돌리기 ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
function pick(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...actionMeshes, ...walkables], false)[0];
  if (!hit) return null;
  return hit.object.userData.action ? { action: hit.object.userData.action } : { point: hit.point };
}
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || busy) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const h = pick(e);
  if (!h) return;
  if (h.action) goDo(h.action);
  else goTo(h.point);
});
let hoverT = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || performance.now() - hoverT < 50) return;
  hoverT = performance.now();
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(actionMeshes, false)[0];
  const tip = $('tip');
  if (hit) {
    tip.textContent = hit.object.userData.action.name;
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
    tip.hidden = false;
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tip.hidden = true;
    renderer.domElement.style.cursor = '';
  }
});

function clampTarget(p) {
  if (onRoof()) {
    return new THREE.Vector3(
      THREE.MathUtils.clamp(p.x, R.x - 12.2, R.x + 12.2), R.y,
      THREE.MathUtils.clamp(p.z, R.z - 8.2, R.z + 5.6));
  }
  return new THREE.Vector3(THREE.MathUtils.clamp(p.x, -19.4, 19.4), 0, THREE.MathUtils.clamp(p.z, -13.4, 21));
}

// 옥상은 막는 선이 없다. 1층은 정문·게이트를 지나는 길로(logic.js)
function route(to) {
  if (onRoof()) return { points: [to], blocked: null };
  const r = planPath({ x: me.position.x, z: me.position.z }, { x: to.x, z: to.z }, stampedToday());
  return { points: r.points.map((p) => new THREE.Vector3(p.x, 0, p.z)), blocked: r.blocked };
}

function standUp() {
  if (!sitting) return;
  sitting = false;
  me.position.y = R.y;
}

function goTo(point) {
  if (onRoof() !== point.y > 20) return; // 다른 층 바닥(멀리 보이는 땅)은 무시
  standUp();
  pending = null;
  const r = route(clampTarget(point));
  path = r.points;
  if (r.blocked) toast('사원증을 먼저 찍어야 들어갈 수 있어요. 오른쪽 리더기를 눌러 주세요.');
}

function goDo(action) {
  if (onRoof() !== action.at.y > 20) return;
  standUp();
  const r = route(action.at);
  if (r.blocked) {
    path = r.points;
    pending = null;
    toast('사원증을 먼저 찍어야 들어갈 수 있어요. 오른쪽 리더기를 눌러 주세요.');
    return;
  }
  path = r.points;
  pending = action;
}

// ---------- 가까운 물건: F·Space·Enter, 또는 화면의 버튼(마우스·터치) ----------
// 같은 층에서 서서 누를 자리(at)가 1.8 안쪽인 것 중 가장 가까운 것
function nearAction() {
  let best = null, bestD = 1.8;
  for (const a of new Set(actionMeshes.map((m) => m.userData.action))) {
    if (onRoof() !== a.at.y > 20) continue;
    const d = Math.hypot(a.at.x - me.position.x, a.at.z - me.position.z);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best;
}

function interact() {
  if (busy) return;
  if (sitting) { standUp(); toast('일어났어요.'); return; }
  const a = nearAction();
  if (!a) { toast('가까이에 할 수 있는 게 없어요. 물건 앞으로 가 보세요.'); return; }
  path = [];
  pending = null;
  a.run();
}
$('act').onclick = interact;

let actShown = '';
function refreshActButton() {
  const a = busy ? null : nearAction();
  const label = sitting ? '일어나기' : a ? a.name : '';
  if (label === actShown) return;
  actShown = label;
  $('act').hidden = !label;
  $('act-label').textContent = label;
}

// ---------- 키보드: WASD·방향키 이동, Q/E 화면 돌리기, -/= 확대·축소 ----------
const MOVE = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const keys = new Set();
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const uiOpen = () => !$('panel').hidden || !$('intro').hidden;
addEventListener('keydown', (e) => {
  if (typing(e.target) || uiOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (MOVE[e.code] || e.code === 'KeyQ' || e.code === 'KeyE') {
    keys.add(e.code);
    e.preventDefault(); // 방향키가 페이지를 스크롤하지 않게
  } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomBy(1.15);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomBy(1 / 1.15);
  else if ((e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault(); // 버튼에 포커스가 있으면 그 버튼이 Space·Enter 를 받는다
    if (!e.repeat) interact();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear()); // 다른 창으로 가면 누른 키가 풀리지 않는 문제

function zoomBy(f) {
  const off = camera.position.clone().sub(controls.target);
  off.setLength(THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(off);
}

const UP = new THREE.Vector3(0, 1, 0);
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), step = new THREE.Vector3();
let gateToastAt = 0;
// 한 걸음: 통째로 막히면 x 만, z 만 따로 시도해 벽을 따라 미끄러진다
function tryStep(d) {
  for (const c of [d, new THREE.Vector3(d.x, 0, 0), new THREE.Vector3(0, 0, d.z)]) {
    if (!c.lengthSq()) continue;
    const to = clampTarget(me.position.clone().add(c));
    const b = onRoof() ? null : blockedStep({ x: me.position.x, z: me.position.z }, { x: to.x, z: to.z }, stampedToday());
    if (!b) { me.position.x = to.x; me.position.z = to.z; return c; }
    if (b === 'gate' && performance.now() - gateToastAt > 3000) {
      gateToastAt = performance.now();
      toast('사원증을 먼저 찍어야 들어갈 수 있어요. 오른쪽 리더기 앞에서 F.');
    }
  }
  return null;
}

// 누르고 있는 이동 키 → 이번 프레임에 갈 방향(카메라 기준: W 는 화면 안쪽). 걸었으면 그 방향, 아니면 null
function keyboardMove(dt) {
  let kx = 0, kz = 0;
  for (const k of keys) if (MOVE[k]) { kx += MOVE[k][0]; kz += MOVE[k][1]; }
  const turn = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  if (turn) {
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(UP, turn * dt * 1.8);
    camera.position.copy(controls.target).add(off);
  }
  if ((!kx && !kz) || busy) return null;
  path = []; // 키를 누르면 클릭으로 가던 길은 취소
  pending = null;
  standUp();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, UP);
  step.copy(fwd).multiplyScalar(kz).addScaledVector(right, kx);
  if (!step.lengthSq()) return null;
  step.setLength(SPEED * dt);
  return tryStep(step);
}

// ---------- 패널 ----------
let panelClose = null;
let panelReturn = null; // 닫으면 포커스를 돌려줄 곳(키보드 사용자)
function openPanel(title, node, onClose) {
  panelReturn = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
  keys.clear();
  $('panel-title').textContent = title;
  $('panel-body').replaceChildren(node);
  $('panel').hidden = false;
  panelClose = onClose;
  ($('panel-body').querySelector('textarea, button') || $('panel-close')).focus();
}
function closePanel() {
  if ($('panel').hidden) return;
  $('panel').hidden = true;
  panelClose?.();
  panelClose = null;
  if (panelReturn) panelReturn.focus();
  else document.activeElement?.blur(); // 닫자마자 Space 가 버튼을 다시 누르지 않게
  panelReturn = null;
}
$('panel-close').onclick = closePanel;
$('panel').addEventListener('pointerdown', (e) => { if (e.target === $('panel')) closePanel(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

$('stamp-btn').onclick = () => {
  const wrap = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = `최근 4주. 연속 ${streak(stamps, today())}일, 모두 ${stamps.length}일 출근했어요.`;
  const grid = document.createElement('div');
  grid.className = 'days';
  const d = new Date();
  d.setDate(d.getDate() - 27);
  for (let i = 0; i < 28; i++) {
    const k = dayKey(d);
    const cell = document.createElement('div');
    cell.textContent = stamps.includes(k) ? '출근' : `${d.getMonth() + 1}/${d.getDate()}`;
    if (stamps.includes(k)) cell.classList.add('on');
    if (k === today()) cell.classList.add('today');
    cell.title = k;
    grid.appendChild(cell);
    d.setDate(d.getDate() + 1);
  }
  wrap.append(p, grid);
  openPanel('출근 기록', wrap);
};

$('enter').onclick = () => {
  $('intro').hidden = true;
  $('enter').blur();
  toast(stampedToday() ? '오늘은 이미 출근했어요. 들어가서 쉬어 가요.' : '정문으로 들어가서 사원증을 찍어 보세요.');
};

// ---------- 하늘·빛 ----------
// 주소에 ?hour=21 처럼 붙이면 그 시각으로 본다(캡처·시험용)
const hourParam = new URLSearchParams(location.search).get('hour');
const hourNow = () => {
  if (hourParam !== null && !Number.isNaN(Number(hourParam))) return Number(hourParam);
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60;
};
let lastSkyArea = null, lastSkyMin = -1;
function applySky(force) {
  const h = hourNow();
  const min = Math.floor(h * 60);
  const area = onRoof() ? 'roof' : 'ground';
  if (!force && min === lastSkyMin && area === lastSkyArea) return;
  lastSkyMin = min;
  lastSkyArea = area;
  const s = skyAt(h);
  const sky = new THREE.Color(s.sky);
  scene.background = sky;
  scene.fog.color.copy(sky);
  windowMat.color.copy(sky);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  $('clock').textContent = `${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} · ${s.label}`;
  if (area === 'roof') {
    // 옥상은 바깥이라 하늘 그대로
    scene.fog.near = 90; scene.fog.far = 260;
    hemi.intensity = s.ambient;
    hemi.color.set(s.night ? '#9fb0d0' : '#ffffff');
    sun.intensity = s.night ? 0.35 : Math.max(0.15, s.sun);
    sun.color.set(s.night ? '#a9bbe0' : s.label === '낮' ? '#fff1dc' : '#ffc99a');
  } else {
    // 1층은 실내 조명이 늘 켜져 있다
    scene.fog.near = 60; scene.fog.far = 140;
    hemi.intensity = 1.0;
    hemi.color.set('#ffffff');
    sun.intensity = 1.1;
    sun.color.set('#fff1dc');
  }
  const a = (Math.PI * (h - 6)) / 12; // 6시 동쪽, 18시 서쪽
  sunDisc.position.set(Math.cos(a) * 150, Math.sin(a) * 70, -90);
  moonDisc.position.set(-Math.cos(a) * 150, -Math.sin(a) * 70, -90);
  sunDisc.visible = s.elev > -0.05;
  moonDisc.visible = s.night;
  stars.visible = s.night;
  cityLit.emissiveIntensity = s.night ? 1.0 : 0;
  bulbMat.color.set(s.night ? '#ffd38a' : '#ece8de');
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
const SPEED = 4.2;
const tmp = new THREE.Vector3();
let walkT = 0;
function face(d, dt) {
  let diff = Math.atan2(d.x, d.z) - me.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  me.rotation.y += diff * Math.min(1, dt * 12);
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  let walking = false;
  if (path.length && !busy) {
    const p = path[0];
    tmp.set(p.x - me.position.x, 0, p.z - me.position.z);
    const dist = tmp.length();
    const step = SPEED * dt;
    if (dist <= step) {
      me.position.x = p.x;
      me.position.z = p.z;
      path.shift();
      if (!path.length && pending) { const a = pending; pending = null; a.run(); }
    } else {
      tmp.multiplyScalar(step / dist);
      me.position.add(tmp);
      face(tmp, dt);
      walking = true;
    }
  }
  const moved = keyboardMove(dt);
  if (moved) { face(moved, dt); walking = true; }
  // 걷기·앉기 자세
  walkT = walking ? walkT + dt * 10 : 0;
  const { legs, arms } = me.userData;
  const swing = walking ? Math.sin(walkT) * 0.55 : 0;
  legs[0].rotation.x = sitting ? -Math.PI / 2 : swing;
  legs[1].rotation.x = sitting ? -Math.PI / 2 : -swing;
  arms[0].rotation.x = -swing * 0.8;
  arms[1].rotation.x = swing * 0.8;

  const fadeTo = !onRoof() && me.position.z < 11 ? 0.12 : 1;
  entranceMat.opacity += (fadeTo - entranceMat.opacity) * Math.min(1, dt * 6);
  logo.material.opacity = entranceMat.opacity;

  // 게이트 유리문: 도장을 찍었으면 열린다
  for (const f of flaps) {
    const goal = stampedToday() ? -f.userData.side * Math.PI * 0.48 : 0; // 안쪽(북쪽)으로 열림
    f.rotation.y += (goal - f.rotation.y) * Math.min(1, dt * 5);
  }
  // 커피 차오르기
  if (brewing > 0) {
    brewing = Math.max(0, brewing - dt);
    liquid.scale.y = Math.max(0.01, 1 - brewing / 2.4);
    if (!brewing) toast('커피 다 됐어요. 천천히 마셔요.');
  }

  // 카메라가 나를 따라온다(돌린 각도는 유지)
  tmp.set(me.position.x, me.position.y + 1.2, me.position.z).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 6));
  controls.target.add(tmp);
  camera.position.add(tmp);
  controls.update();

  sun.position.set(me.position.x + 14, me.position.y + 26, me.position.z + 12);
  sun.target.position.copy(me.position);

  applySky(false);
  $('place').textContent = placeName();
  refreshActButton();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = fovFor(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ?debug 를 붙이면 콘솔에서 상태를 만질 수 있다(시험·캡처용)
if (new URLSearchParams(location.search).has('debug')) {
  window.comma = { THREE, scene, me, camera, controls, actions: actionMeshes.map((m) => m.userData.action), goDo, goTo, interact, nearAction, get path() { return path; }, stampedToday };
}

refreshHud();
applySky(true);
$('enter').focus(); // 키보드만 쓰는 사람도 Enter 로 바로 시작
frame();
