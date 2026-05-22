import * as THREE from "./vendor/three.module.js";

const canvas = document.querySelector("#game");
const startPanel = document.querySelector("#start-panel");
const startButton = document.querySelector("#start-button");
const quitButton = document.querySelector("#quit-button");
const hotbar = document.querySelector("#hotbar");
const blockLabel = document.querySelector("#block-label");
const positionLabel = document.querySelector("#position-label");

const WORLD_SIZE = 100;
const HALF_WORLD = WORLD_SIZE / 2;
const WORLD_DEPTH = 18;
const MIN_WORLD_Y = -WORLD_DEPTH;
const MAX_WORLD_Y = 40;
const BEACH_HEIGHT = 7;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.28;
const JUMP_SPEED = 8.2;
const FALL_SLOWDOWN_FACTOR = 0.75;
const GRAVITY = 24;
const SPAWN_CLEAR_RADIUS = 10;
const SPAWN_TREE_FREE_RADIUS = 15;
const SPAWN_POINTS = [
  { x: 38, y: 9, z: 13 },
  { x: 20, y: 14, z: 14 },
  { x: 3, y: 15, z: 4 },
  { x: -28, y: 11, z: -14 },
  { x: -38, y: 7, z: 25 }
];

const faces = [
  {
    name: "front",
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1]
    ]
  },
  {
    name: "back",
    normal: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0]
    ]
  },
  {
    name: "right",
    normal: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1]
    ]
  },
  {
    name: "left",
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0]
    ]
  },
  {
    name: "top",
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0]
    ]
  },
  {
    name: "bottom",
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ]
  }
];

const blockTypes = [
  { id: 1, name: "草方块", key: "grass", top: "#79b84a", side: "#6f9145", bottom: "#744d2f" },
  { id: 2, name: "泥土", key: "dirt", top: "#8b5a34", side: "#77492d", bottom: "#5f3b27" },
  { id: 3, name: "石头", key: "stone", top: "#92989b", side: "#777f83", bottom: "#62696d" },
  { id: 4, name: "沙子", key: "sand", top: "#d9c679", side: "#c4ad62", bottom: "#a88f4d" },
  { id: 5, name: "树干", key: "wood", top: "#b9854e", side: "#6b3a1f", bottom: "#8f552d" },
  { id: 6, name: "树叶", key: "leaves", top: "#3f9b58", side: "#327f48", bottom: "#28683b" }
];

const emptyHotbarItem = { id: 0, name: "空物品栏", key: "empty", empty: true };
const hotbarItems = [...blockTypes, emptyHotbarItem];
const allBlocks = [...blockTypes];
const blockById = new Map(allBlocks.map((block) => [block.id, block]));
const solidIds = new Set([1, 2, 3, 4, 5, 6]);
const world = new Map();
const treePositions = [];
const keys = new Set();
let selectedBlock = 1;
let yaw = 0;
let pitch = 0;
let grounded = false;
let gameActive = false;
let menuMode = "title";
let draggingLook = false;
let velocity = new THREE.Vector3();
let selectedTarget = null;
let meshes = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fcdec);
scene.fog = new THREE.Fog(0x8fcdec, 58, 150);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 150);
camera.position.set(0, 17, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const sun = new THREE.DirectionalLight(0xfff0c8, 2.4);
sun.position.set(18, 34, 12);
sun.castShadow = true;
sun.shadow.camera.left = -82;
sun.shadow.camera.right = 82;
sun.shadow.camera.top = 82;
sun.shadow.camera.bottom = -82;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xb7e3ff, 0x4b593e, 1.1));

const selector = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
);
selector.visible = false;
scene.add(selector);

const materials = createMaterials();
const worldGroup = new THREE.Group();
scene.add(worldGroup);

const raycaster = new THREE.Raycaster();
raycaster.far = 6;
const clock = new THREE.Clock();

rebuildWorldMesh();
buildHotbar();
animate();

startButton.addEventListener("click", () => {
  enterGame();
});

quitButton.addEventListener("click", () => {
  closeGamePage();
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) gameActive = true;
  if (document.pointerLockElement === canvas) startPanel.classList.add("hidden");
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas && !draggingLook) return;
  yaw -= event.movementX * 0.0023;
  pitch -= event.movementY * 0.0023;
  pitch = THREE.MathUtils.clamp(pitch, -1.45, 1.45);
});

document.addEventListener(
  "wheel",
  (event) => {
    if (!gameActive && document.pointerLockElement !== canvas) return;
    event.preventDefault();
    if (event.deltaY < 0) selectBlockOffset(1);
    if (event.deltaY > 0) selectBlockOffset(-1);
  },
  { passive: false }
);

document.addEventListener("keydown", (event) => {
  if (menuMode === "paused" && !startPanel.classList.contains("hidden")) {
    if (event.code === "Digit1") enterGame();
    if (event.code === "Digit2") closeGamePage();
    return;
  }

  keys.add(event.code);
  if (/^Digit[1-7]$/.test(event.code)) {
    selectedBlock = hotbarItems[Number(event.code.at(-1)) - 1].id;
    updateHotbar();
  }
  if (event.code === "Space" && grounded) {
    jump();
  }
  if (event.code === "Escape" && document.pointerLockElement !== canvas) {
    pauseGame();
  }
});

document.addEventListener("keyup", (event) => keys.delete(event.code));

document.addEventListener("mousedown", (event) => {
  if (event.target instanceof Element && event.target.closest("#auto-jump-panel")) return;
  if (!gameActive && document.pointerLockElement !== canvas) return;
  if (document.pointerLockElement !== canvas && event.target === canvas) draggingLook = true;
  if (!selectedTarget) return;
  event.preventDefault();
  if (event.button === 0) {
    setBlock(selectedTarget.remove.x, selectedTarget.remove.y, selectedTarget.remove.z, 0);
  }
  if (event.button === 2) {
    const place = selectedTarget.place;
    if (selectedBlock !== 0 && !playerIntersectsBlock(place.x, place.y, place.z)) {
      setBlock(place.x, place.y, place.z, selectedBlock);
    }
  }
});

document.addEventListener("mouseup", () => {
  draggingLook = false;
});

document.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  if (gameActive) {
    updatePlayer(dt);
    updateSelection();
  }
  renderer.render(scene, camera);
}

function enterGame() {
  if (menuMode === "title") startNewWorld();
  menuMode = "playing";
  gameActive = true;
  keys.clear();
  startPanel.classList.add("hidden");
  const lockRequest = canvas.requestPointerLock();
  if (lockRequest?.catch) lockRequest.catch(() => {});
}

function pauseGame() {
  if (!gameActive && menuMode !== "playing") return;
  gameActive = false;
  draggingLook = false;
  keys.clear();
  showPauseMenu();
}

function showPauseMenu() {
  menuMode = "paused";
  startButton.textContent = "1继续游戏";
  quitButton.classList.remove("hidden");
  startPanel.classList.remove("hidden");
}

function closeGamePage() {
  gameActive = false;
  draggingLook = false;
  keys.clear();
  selector.visible = false;
  window.close();
  window.setTimeout(() => {
    window.location.href = "about:blank";
  }, 120);
}

function startNewWorld() {
  world.clear();
  treePositions.length = 0;
  selectedTarget = null;
  selector.visible = false;
  selectedBlock = 1;
  generateWorld();
  placePlayerAtSpawn();
  rebuildWorldMesh();
  updateHotbar();
  updatePositionLabel();
}

function updatePlayer(dt) {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const move = new THREE.Vector3();
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();

  const speed = keys.has("ShiftLeft") ? 9.5 : 6.2;
  const horizontal = move.multiplyScalar(speed * dt);
  tryMove(horizontal.x, 0, 0);
  tryMove(0, 0, horizontal.z);

  velocity.y -= GRAVITY * dt;
  const verticalStep = velocity.y * dt;
  const slowedVerticalStep = keys.has("Space") && velocity.y < 0 ? verticalStep * FALL_SLOWDOWN_FACTOR : verticalStep;
  tryMove(0, slowedVerticalStep, 0);

  if (camera.position.y < MIN_WORLD_Y - 8) {
    placePlayerAtSpawn();
    rebuildWorldMesh();
    velocity.set(0, 0, 0);
  }

  updatePositionLabel();
}

function updatePositionLabel() {
  positionLabel.textContent = `${Math.floor(camera.position.x)}, ${Math.floor(camera.position.y)}, ${Math.floor(camera.position.z)}`;
}

function tryMove(dx, dy, dz) {
  if (dx === 0 && dy === 0 && dz === 0) return true;
  const old = camera.position.clone();
  camera.position.x += dx;
  camera.position.y += dy;
  camera.position.z += dz;
  if (collidesWithWorld()) {
    camera.position.copy(old);
    if (dy < 0) grounded = true;
    if (dy !== 0) velocity.y = 0;
    return false;
  } else if (dy !== 0) {
    grounded = false;
  }
  return true;
}

function jump() {
  velocity.y = JUMP_SPEED;
  grounded = false;
}

function collidesWithWorld(position = camera.position) {
  const minX = Math.floor(position.x - PLAYER_RADIUS);
  const maxX = Math.floor(position.x + PLAYER_RADIUS);
  const minY = Math.floor(position.y - PLAYER_HEIGHT);
  const maxY = Math.floor(position.y - 0.12);
  const minZ = Math.floor(position.z - PLAYER_RADIUS);
  const maxZ = Math.floor(position.z + PLAYER_RADIUS);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

function playerIntersectsBlock(x, y, z) {
  return (
    x + 1 > camera.position.x - PLAYER_RADIUS &&
    x < camera.position.x + PLAYER_RADIUS &&
    y + 1 > camera.position.y - PLAYER_HEIGHT &&
    y < camera.position.y &&
    z + 1 > camera.position.z - PLAYER_RADIUS &&
    z < camera.position.z + PLAYER_RADIUS
  );
}

function updateSelection() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) {
    selectedTarget = null;
    selector.visible = false;
    return;
  }

  const hit = hits[0];
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const removePoint = hit.point.clone().addScaledVector(normal, -0.02);
  const placePoint = hit.point.clone().addScaledVector(normal, 0.02);
  const remove = vectorFloor(removePoint);
  const place = vectorFloor(placePoint);

  selectedTarget = { remove, place };
  selector.visible = true;
  selector.position.set(remove.x + 0.5, remove.y + 0.5, remove.z + 0.5);
}

function vectorFloor(vector) {
  return {
    x: Math.floor(vector.x),
    y: Math.floor(vector.y),
    z: Math.floor(vector.z)
  };
}

function generateWorld() {
  for (let x = -HALF_WORLD; x < HALF_WORLD; x += 1) {
    for (let z = -HALF_WORLD; z < HALF_WORLD; z += 1) {
      const distance = Math.hypot(x / HALF_WORLD, z / HALF_WORLD);
      const islandFalloff = THREE.MathUtils.clamp(1.2 - distance, 0, 1);
      const hills = noise2d(x * 0.11, z * 0.11) * 5 + noise2d(x * 0.32 + 90, z * 0.32) * 2;
      const height = Math.max(2, Math.floor(5 + islandFalloff * (8 + hills)));

      for (let y = MIN_WORLD_Y; y <= height; y += 1) {
        let id = 3;
        if (y === height) id = height <= BEACH_HEIGHT ? 4 : 1;
        else if (y > height - 4) id = height <= BEACH_HEIGHT ? 4 : 2;
        setBlockRaw(x, y, z, id);
      }

      const isNearSpawn = Math.hypot(x, z) < SPAWN_TREE_FREE_RADIUS;

      if (
        !isNearSpawn &&
        height > BEACH_HEIGHT &&
        noise2d(x * 0.44 + 12, z * 0.44 - 7) > 0.67 &&
        canPlantTree(x, z)
      ) {
        addTree(x, height + 1, z);
        treePositions.push({ x, z });
      }

    }
  }
}

function placePlayerAtSpawn() {
  const spawnPoint = findSpawnPoint();
  if (!spawnPoint) return;

  clearSpawnArea(spawnPoint.x, spawnPoint.groundY, spawnPoint.z);
  camera.position.copy(spawnPoint.position);
  velocity.set(0, 0, 0);
  grounded = true;
  yaw = -Math.PI / 2;
}

function findSpawnPoint() {
  const point = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  const groundY = Math.max(1, point.y - 2);
  return {
    x: point.x,
    groundY,
    z: point.z,
    position: spawnPositionFor(point.x, groundY, point.z)
  };
}

function spawnPositionFor(x, groundY, z) {
  return new THREE.Vector3(x + 0.5, groundY + 1 + PLAYER_HEIGHT + 0.04, z + 0.5);
}

function clearSpawnArea(x, groundY, z) {
  for (let dx = -SPAWN_CLEAR_RADIUS; dx <= SPAWN_CLEAR_RADIUS; dx += 1) {
    for (let dz = -SPAWN_CLEAR_RADIUS; dz <= SPAWN_CLEAR_RADIUS; dz += 1) {
      if (Math.hypot(dx, dz) > SPAWN_CLEAR_RADIUS + 0.35) continue;
      const clearX = x + dx;
      const clearZ = z + dz;
      if (!isInsideWorld(clearX, clearZ)) continue;

      setBlockRaw(clearX, groundY, clearZ, 1);
      for (let y = MIN_WORLD_Y; y < groundY; y += 1) {
        if (getBlock(clearX, y, clearZ) !== 0) continue;
        setBlockRaw(clearX, y, clearZ, y > groundY - 4 ? 2 : 3);
      }
      for (let y = groundY + 1; y <= MAX_WORLD_Y; y += 1) {
        setBlockRaw(clearX, y, clearZ, 0);
      }
    }
  }
}

function isInsideWorld(x, z) {
  return x >= -HALF_WORLD && x < HALF_WORLD && z >= -HALF_WORLD && z < HALF_WORLD;
}

function addTree(x, y, z) {
  const trunkHeight = 4 + Math.floor(noise2d(x + 20, z - 20) * 2);
  for (let i = 0; i < trunkHeight; i += 1) setBlockRaw(x, y + i, z, 5);
  const crownY = y + trunkHeight;

  const leafBlocks = [
    [-1, -1, 0],
    [1, -1, 0],
    [0, -1, -1],
    [0, -1, 1],
    [-1, 0, -1],
    [-1, 0, 0],
    [-1, 0, 1],
    [0, 0, -1],
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, -1],
    [1, 0, 0],
    [1, 0, 1],
    [-1, 1, 0],
    [0, 1, -1],
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 0],
    [0, 2, 0]
  ];

  for (const [dx, dy, dz] of leafBlocks) {
    setBlockRaw(x + dx, crownY + dy, z + dz, 6);
  }
}

function canPlantTree(x, z) {
  return treePositions.every((tree) => Math.hypot(tree.x - x, tree.z - z) >= 5);
}

function setBlock(x, y, z, id) {
  if (y < MIN_WORLD_Y || y > MAX_WORLD_Y) return;
  setBlockRaw(x, y, z, id);
  rebuildWorldMesh();
}

function setBlockRaw(x, y, z, id) {
  const key = blockKey(x, y, z);
  if (!id) world.delete(key);
  else world.set(key, id);
}

function getBlock(x, y, z) {
  return world.get(blockKey(x, y, z)) || 0;
}

function isSolid(x, y, z) {
  return solidIds.has(getBlock(x, y, z));
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function rebuildWorldMesh() {
  for (const child of worldGroup.children) {
    child.geometry.dispose();
  }
  worldGroup.clear();
  meshes = [];

  const buffers = new Map();
  for (const [key, id] of world.entries()) {
    const [x, y, z] = key.split(",").map(Number);
    for (const face of faces) {
      const neighbor = getBlock(x + face.normal[0], y + face.normal[1], z + face.normal[2]);
      if (neighbor !== 0) continue;
      const materialKey = materialForFace(id, face.name);
      if (!buffers.has(materialKey)) buffers.set(materialKey, { positions: [], normals: [], uvs: [] });
      pushFace(buffers.get(materialKey), x, y, z, face);
    }
  }

  for (const [materialKey, data] of buffers.entries()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, materials.get(materialKey));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
    worldGroup.add(mesh);
  }
}

function pushFace(buffer, x, y, z, face) {
  const corners = face.corners;
  const vertices = [0, 1, 2, 0, 2, 3];
  const uvs = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ];

  for (const index of vertices) {
    const corner = corners[index];
    buffer.positions.push(x + corner[0], y + corner[1], z + corner[2]);
    buffer.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    buffer.uvs.push(uvs[index][0], uvs[index][1]);
  }
}

function materialForFace(id, faceName) {
  const block = blockById.get(id);
  if (faceName === "top") return `${block.key}-top`;
  if (faceName === "bottom") return `${block.key}-bottom`;
  return `${block.key}-side`;
}

function createMaterials() {
  const result = new Map();
  for (const block of allBlocks) {
    result.set(`${block.key}-top`, makeMaterial(block.top, block.key, "top"));
    result.set(`${block.key}-side`, makeMaterial(block.side, block.key, "side"));
    result.set(`${block.key}-bottom`, makeMaterial(block.bottom, block.key, "bottom"));
  }
  return result;
}

function makeMaterial(baseColor, key, face) {
  const texture = makeVoxelTexture(baseColor, key, face);
  return new THREE.MeshLambertMaterial({
    map: texture,
    transparent: key === "leaves",
    alphaTest: key === "leaves" ? 0.18 : 0,
    side: THREE.FrontSide
  });
}

function makeVoxelTexture(baseColor, key, face) {
  const size = 32;
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const ctx = canvasTexture.getContext("2d");
  const color = new THREE.Color(baseColor);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const value = hash2d(x + key.length * 11, y + face.length * 17);
      const patch = color.clone().offsetHSL(0, 0, (value - 0.5) * 0.22);
      ctx.fillStyle = `#${patch.getHexString()}`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  if (key === "grass" && face === "side") {
    ctx.fillStyle = "#7fc24b";
    for (let x = 0; x < size; x += 4) ctx.fillRect(x, 0, 4, 6 + (x % 3) * 2);
  }

  if (key === "wood" && face === "side") {
    ctx.fillStyle = "#6b3a1f";
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 4) {
      const strip = x % 8 === 0 ? "#7a4324" : "#5d311b";
      ctx.fillStyle = strip;
      ctx.fillRect(x, 0, 3, size);
    }
    ctx.fillStyle = "#2f1a10";
    for (let x = 3; x < size; x += 8) {
      ctx.fillRect(x, 0, 1, size);
      ctx.fillRect(x + 1, 8, 1, 7);
      ctx.fillRect(x - 1, 21, 1, 6);
    }
    ctx.fillStyle = "#a86836";
    ctx.fillRect(8, 5, 5, 2);
    ctx.fillRect(19, 19, 6, 2);
  }

  if (key === "wood" && face !== "side") {
    ctx.fillStyle = "#b9854e";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d09a60";
    ctx.fillRect(4, 4, 24, 24);
    ctx.strokeStyle = "#6d3d21";
    ctx.lineWidth = 2;
    for (let radius = 5; radius <= 13; radius += 4) {
      ctx.beginPath();
      ctx.ellipse(16, 16, radius, Math.max(3, radius - 2), 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#5a301b";
    ctx.fillRect(15, 15, 3, 3);
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildHotbar() {
  hotbar.innerHTML = "";
  hotbarItems.forEach((block, index) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.classList.toggle("empty", block.empty);
    slot.title = block.name;
    slot.innerHTML = block.empty ? `<kbd>${index + 1}</kbd>` : `<canvas class="swatch" width="30" height="30"></canvas><kbd>${index + 1}</kbd>`;
    const swatch = slot.querySelector("canvas");
    if (swatch) swatch.getContext("2d").drawImage(materials.get(`${block.key}-top`).map.image, 0, 0, 30, 30);
    hotbar.append(slot);
  });
  updateHotbar();
}

function updateHotbar() {
  [...hotbar.children].forEach((slot, index) => {
    slot.classList.toggle("active", hotbarItems[index].id === selectedBlock);
  });
  blockLabel.textContent = hotbarItems[selectedHotbarIndex()].name;
}

function selectBlockOffset(offset) {
  const nextIndex = (selectedHotbarIndex() + offset + hotbarItems.length) % hotbarItems.length;
  selectedBlock = hotbarItems[nextIndex].id;
  updateHotbar();
}

function selectedHotbarIndex() {
  return Math.max(0, hotbarItems.findIndex((item) => item.id === selectedBlock));
}

function noise2d(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const tl = hash2d(xi, yi);
  const tr = hash2d(xi + 1, yi);
  const bl = hash2d(xi, yi + 1);
  const br = hash2d(xi + 1, yi + 1);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(tl, tr, u), THREE.MathUtils.lerp(bl, br, u), v);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function hash2d(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
