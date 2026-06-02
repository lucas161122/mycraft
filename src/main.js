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
const RESPAWN_Y = -50;
const BEACH_HEIGHT = 7;
const COAL_VEIN_SPACING = 12;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.28;
const JUMP_SPEED = 8.2;
const FALL_SLOWDOWN_FACTOR = 0.75;
const GRAVITY = 24;
const FLY_SPEED = 8;
const MAX_FLIGHT_Y = 100;
const DOUBLE_SPACE_WINDOW_MS = 320;
const PIG_COUNT = 12;
const PIG_RADIUS = 0.45;
const PIG_HEIGHT = 0.9;
const PIG_FRONT_CLEARANCE = 0.7;
const PIG_SPEED = 1.35;
const PIG_JUMP_SPEED = 6.5;
const PIG_GRAVITY = 18;
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
  { id: 1, name: "草方块", key: "grass", top: "#6eae3d", side: "#855832", bottom: "#744d2f" },
  { id: 2, name: "泥土", key: "dirt", top: "#8b5a34", side: "#77492d", bottom: "#5f3b27" },
  { id: 3, name: "石头", key: "stone", top: "#92989b", side: "#777f83", bottom: "#62696d" },
  { id: 4, name: "沙子", key: "sand", top: "#d9c679", side: "#c4ad62", bottom: "#a88f4d" },
  { id: 5, name: "树干", key: "wood", top: "#b9854e", side: "#6b3a1f", bottom: "#8f552d" },
  { id: 6, name: "树叶", key: "leaves", top: "#3f9b58", side: "#327f48", bottom: "#28683b" },
  { id: 7, name: "仙人掌", key: "cactus", top: "#58a84a", side: "#438f3f", bottom: "#347936" },
  { id: 8, name: "煤矿", key: "coal", top: "#777d7f", side: "#666c6e", bottom: "#555b5d" }
];

const allBlocks = [...blockTypes];
const blockById = new Map(allBlocks.map((block) => [block.id, block]));
const hotbarItems = [1, 2, 3, 8, 5, 6, 4, 7].map((id) => blockById.get(id));
const solidIds = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const world = new Map();
const treePositions = [];
const cactusPositions = [];
const pigs = [];
const pigWalkableIds = new Set([1, 2, 3, 4]);
const keys = new Set();
let selectedBlock = 1;
let yaw = 0;
let pitch = 0;
let grounded = false;
let flying = false;
let lastSpacePressAt = -Infinity;
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
const pigMaterials = createPigMaterials(loadPigSkinTexture());
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const pigGroup = new THREE.Group();
scene.add(pigGroup);

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
  if (/^Digit[1-8]$/.test(event.code)) {
    selectedBlock = hotbarItems[Number(event.code.at(-1)) - 1].id;
    updateHotbar();
  }
  if (event.code === "Space" && !event.repeat) {
    handleSpacePress();
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
    if (
      selectedBlock !== 0 &&
      canPlaceBlock(place.x, place.y, place.z, selectedBlock) &&
      !playerIntersectsBlock(place.x, place.y, place.z) &&
      !pigIntersectsBlock(place.x, place.y, place.z)
    ) {
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
    updatePigs(dt);
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
  cactusPositions.length = 0;
  clearPigs();
  selectedTarget = null;
  selector.visible = false;
  selectedBlock = 1;
  flying = false;
  lastSpacePressAt = -Infinity;
  generateWorld();
  placePlayerAtSpawn();
  spawnPigs();
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

  const shiftPressed = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = !flying && shiftPressed ? 9.5 : 6.2;
  const horizontal = move.multiplyScalar(speed * dt);
  tryMove(horizontal.x, 0, 0);
  tryMove(0, 0, horizontal.z);

  if (flying) {
    velocity.y = 0;
    const verticalDirection = Number(keys.has("Space")) - Number(shiftPressed);
    const verticalStep = verticalDirection * FLY_SPEED * dt;
    const cappedVerticalStep = verticalStep > 0 ? Math.min(verticalStep, MAX_FLIGHT_Y - camera.position.y) : verticalStep;
    tryMove(0, cappedVerticalStep, 0);
  } else {
    velocity.y -= GRAVITY * dt;
    const verticalStep = velocity.y * dt;
    const slowedVerticalStep = keys.has("Space") && velocity.y < 0 ? verticalStep * FALL_SLOWDOWN_FACTOR : verticalStep;
    tryMove(0, slowedVerticalStep, 0);
  }

  if (camera.position.y < RESPAWN_Y) {
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
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.1));
  const stepX = dx / steps;
  const stepY = dy / steps;
  const stepZ = dz / steps;

  for (let step = 0; step < steps; step += 1) {
    const old = camera.position.clone();
    camera.position.x += stepX;
    camera.position.y += stepY;
    camera.position.z += stepZ;
    if (collidesWithWorld() || collidesWithPig()) {
      camera.position.copy(old);
      if (dy < 0) grounded = true;
      if (dy !== 0) velocity.y = 0;
      return false;
    }
  }

  if (dy !== 0) grounded = false;
  return true;
}

function jump() {
  velocity.y = JUMP_SPEED;
  grounded = false;
}

function handleSpacePress() {
  const now = performance.now();
  if (now - lastSpacePressAt <= DOUBLE_SPACE_WINDOW_MS) {
    setFlying(!flying);
    lastSpacePressAt = -Infinity;
    return;
  }

  lastSpacePressAt = now;
  if (!flying && grounded) jump();
}

function setFlying(enabled) {
  flying = enabled;
  velocity.y = 0;
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

function collidesWithPig(position = camera.position) {
  const playerMinY = position.y - PLAYER_HEIGHT;
  const playerMaxY = position.y;
  return pigs.some((pig) => {
    const pigPosition = pig.root.position;
    return (
      Math.abs(pigPosition.x - position.x) < PIG_RADIUS + PLAYER_RADIUS &&
      Math.abs(pigPosition.z - position.z) < PIG_RADIUS + PLAYER_RADIUS &&
      pigPosition.y + PIG_HEIGHT > playerMinY &&
      pigPosition.y < playerMaxY
    );
  });
}

function pigIntersectsBlock(x, y, z) {
  return pigs.some((pig) => {
    const position = pig.root.position;
    return (
      x + 1 > position.x - PIG_RADIUS &&
      x < position.x + PIG_RADIUS &&
      y + 1 > position.y &&
      y < position.y + PIG_HEIGHT &&
      z + 1 > position.z - PIG_RADIUS &&
      z < position.z + PIG_RADIUS
    );
  });
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

      if (
        height <= BEACH_HEIGHT &&
        getBlock(x, height, z) === 4 &&
        hash2d(x + 203, z - 137) > 0.985 &&
        canPlantCactus(x, z)
      ) {
        addCactus(x, height + 1, z);
        cactusPositions.push({ x, z });
      }

    }
  }

  generateCoalDeposits();
}

function placePlayerAtSpawn() {
  const spawnPoint = findSpawnPoint();
  if (!spawnPoint) return;

  clearSpawnArea(spawnPoint.x, spawnPoint.groundY, spawnPoint.z);
  camera.position.copy(spawnPoint.position);
  velocity.set(0, 0, 0);
  grounded = true;
  flying = false;
  lastSpacePressAt = -Infinity;
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

function clearPigs() {
  pigs.length = 0;
  pigGroup.clear();
}

function spawnPigs() {
  const candidates = [];
  for (let x = -HALF_WORLD + 2; x < HALF_WORLD - 2; x += 2) {
    for (let z = -HALF_WORLD + 2; z < HALF_WORLD - 2; z += 2) {
      const centerX = x + 0.5;
      const centerZ = z + 0.5;
      const groundY = findPigSurfaceY(centerX, centerZ, MAX_WORLD_Y);
      if (groundY === null) continue;
      if (pigCollidesWithWorld(centerX, groundY, centerZ)) continue;

      candidates.push({
        x: centerX,
        y: groundY,
        z: centerZ,
        score: hash2d(x + 617, z - 283)
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  for (const candidate of candidates) {
    if (pigs.length >= PIG_COUNT) break;
    if (pigs.some((pig) => Math.hypot(pig.root.position.x - candidate.x, pig.root.position.z - candidate.z) < 4)) continue;
    pigs.push(createPig(candidate.x, candidate.y, candidate.z));
  }
}

function createPig(x, y, z) {
  const root = new THREE.Group();
  const legs = [];

  addPigPart(root, [0.625, 1, 0.5], [0, 0.625, 0], pigMaterials.body, [Math.PI / 2, 0, 0]);
  addPigPart(root, [0.5, 0.5, 0.5], [0, 0.625, -0.625], pigMaterials.head);
  addPigPart(root, [0.25, 0.1875, 0.0625], [0, 0.59, -0.90625], pigMaterials.snout);
  addPigPart(root, [0.0625, 0.0625, 0.03125], [-0.15625, 0.71875, -0.890625], pigMaterials.eye);
  addPigPart(root, [0.0625, 0.0625, 0.03125], [0.15625, 0.71875, -0.890625], pigMaterials.eye);

  for (const [legX, legZ] of [
    [-0.1875, -0.3125],
    [0.1875, -0.3125],
    [-0.1875, 0.3125],
    [0.1875, 0.3125]
  ]) {
    const leg = addPigPart(root, [0.25, 0.375, 0.25], [legX, 0.1875, legZ], pigMaterials.leg);
    legs.push(leg);
  }

  const direction = hash2d(x + 41, z - 97) * Math.PI * 2;
  root.position.set(x, y, z);
  root.rotation.y = direction;
  pigGroup.add(root);

  return {
    root,
    legs,
    direction,
    grounded: true,
    verticalVelocity: 0,
    walkTime: hash2d(x - 19, z + 71) * Math.PI * 2,
    turnTimer: 1.6 + hash2d(x + 83, z - 11) * 3.6
  };
}

function addPigPart(root, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function updatePigs(dt) {
  for (const pig of pigs) {
    pig.turnTimer -= dt;
    if (pig.turnTimer <= 0) {
      pig.direction += (hash2d(pig.root.position.x + pig.walkTime, pig.root.position.z - pig.walkTime) - 0.5) * Math.PI;
      pig.turnTimer = 1.8 + hash2d(pig.root.position.z + 37, pig.root.position.x - 53) * 3.8;
    }

    updatePigVertical(pig, dt);

    const stepX = -Math.sin(pig.direction) * PIG_SPEED * dt;
    const stepZ = -Math.cos(pig.direction) * PIG_SPEED * dt;
    if (!tryMovePig(pig, stepX, stepZ)) turnPigAround(pig);

    pig.root.rotation.y = pig.direction;
    pig.walkTime += dt * 8;
    const legSwing = pig.grounded ? Math.sin(pig.walkTime) * 0.44 : 0.18;
    pig.legs.forEach((leg, index) => {
      leg.rotation.x = index % 2 === 0 ? legSwing : -legSwing;
    });
  }
}

function updatePigVertical(pig, dt) {
  if (pig.grounded) return;

  pig.verticalVelocity -= PIG_GRAVITY * dt;
  const nextY = pig.root.position.y + pig.verticalVelocity * dt;
  const groundY = findPigSurfaceY(pig.root.position.x, pig.root.position.z, pig.root.position.y);

  if (pig.verticalVelocity <= 0 && groundY !== null && nextY <= groundY) {
    pig.root.position.y = groundY;
    pig.verticalVelocity = 0;
    pig.grounded = true;
    return;
  }

  pig.root.position.y = nextY;
  if (pig.root.position.y < RESPAWN_Y) respawnPig(pig);
}

function tryMovePig(pig, dx, dz) {
  const nextX = pig.root.position.x + dx;
  const nextZ = pig.root.position.z + dz;
  const currentY = pig.root.position.y;
  const stepLength = Math.hypot(dx, dz);
  const forwardX = stepLength ? dx / stepLength : 0;
  const forwardZ = stepLength ? dz / stepLength : 0;
  const probeX = nextX + forwardX * PIG_FRONT_CLEARANCE;
  const probeZ = nextZ + forwardZ * PIG_FRONT_CLEARANCE;
  const probeGroundY = findPigSurfaceY(probeX, probeZ, currentY);
  const nextGroundY = findPigSurfaceY(nextX, nextZ, currentY);

  if (
    probeGroundY === null ||
    nextGroundY === null ||
    probeGroundY < currentY - 1.05 ||
    probeGroundY > currentY + 1.05 ||
    nextGroundY < currentY - 1.05 ||
    nextGroundY > currentY + 1.05
  ) {
    return false;
  }

  const climbingOneBlock = probeGroundY > currentY + 0.08;
  if (climbingOneBlock) {
    if (pigCollidesWithWorld(probeX, probeGroundY, probeZ)) return false;
    if (pig.grounded) {
      pig.verticalVelocity = PIG_JUMP_SPEED;
      pig.grounded = false;
    }
  }

  if (pigCollidesWithWorld(nextX, currentY, nextZ)) return climbingOneBlock;
  if (pigIntersectsPlayer(nextX, currentY, nextZ)) return false;
  if (pigs.some((other) => other !== pig && Math.hypot(other.root.position.x - nextX, other.root.position.z - nextZ) < PIG_RADIUS * 2)) {
    return false;
  }

  pig.root.position.x = nextX;
  pig.root.position.z = nextZ;
  if (pig.grounded && nextGroundY < currentY - 0.08) pig.grounded = false;
  return true;
}

function pigIntersectsPlayer(x, y, z) {
  return (
    Math.abs(camera.position.x - x) < PIG_RADIUS + PLAYER_RADIUS &&
    Math.abs(camera.position.z - z) < PIG_RADIUS + PLAYER_RADIUS &&
    camera.position.y > y &&
    camera.position.y - PLAYER_HEIGHT < y + PIG_HEIGHT
  );
}

function findPigSurfaceY(x, z, maxFootY) {
  const samples = [
    [0, 0],
    [-PIG_RADIUS * 0.82, -PIG_RADIUS * 0.82],
    [PIG_RADIUS * 0.82, -PIG_RADIUS * 0.82],
    [-PIG_RADIUS * 0.82, PIG_RADIUS * 0.82],
    [PIG_RADIUS * 0.82, PIG_RADIUS * 0.82]
  ];
  const heights = samples.map(([offsetX, offsetZ]) => findPigSurfaceAtPoint(x + offsetX, z + offsetZ, maxFootY));
  if (heights.some((height) => height === null)) return null;

  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  return maxHeight - minHeight <= 1 ? maxHeight : null;
}

function findPigSurfaceAtPoint(x, z, maxFootY) {
  const blockX = Math.floor(x);
  const blockZ = Math.floor(z);
  if (!isInsideWorld(blockX, blockZ)) return null;

  for (let blockY = Math.min(MAX_WORLD_Y, Math.floor(maxFootY)); blockY >= MIN_WORLD_Y; blockY -= 1) {
    const id = getBlock(blockX, blockY, blockZ);
    if (!id) continue;
    return pigWalkableIds.has(id) ? blockY + 1 : null;
  }

  return null;
}

function pigCollidesWithWorld(x, y, z) {
  const minX = Math.floor(x - PIG_RADIUS);
  const maxX = Math.floor(x + PIG_RADIUS);
  const minY = Math.floor(y + 0.02);
  const maxY = Math.floor(y + PIG_HEIGHT - 0.02);
  const minZ = Math.floor(z - PIG_RADIUS);
  const maxZ = Math.floor(z + PIG_RADIUS);

  for (let blockX = minX; blockX <= maxX; blockX += 1) {
    for (let blockY = minY; blockY <= maxY; blockY += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        if (isSolid(blockX, blockY, blockZ)) return true;
      }
    }
  }

  return false;
}

function turnPigAround(pig) {
  pig.direction += Math.PI * (0.7 + hash2d(pig.root.position.x + 13, pig.root.position.z - 29) * 0.6);
  pig.turnTimer = 1.2 + hash2d(pig.root.position.z - 61, pig.root.position.x + 17) * 2.2;
}

function respawnPig(pig) {
  const groundY = findPigSurfaceY(camera.position.x, camera.position.z, MAX_WORLD_Y);
  pig.root.position.set(camera.position.x + 2, groundY ?? 12, camera.position.z + 2);
  pig.verticalVelocity = 0;
  pig.grounded = true;
  turnPigAround(pig);
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

function addCactus(x, y, z) {
  const heightRoll = hash2d(x - 73, z + 181);
  const height = heightRoll < 0.25 ? 1 : heightRoll < 0.5 ? 2 : 3;
  for (let i = 0; i < height; i += 1) setBlockRaw(x, y + i, z, 7);
}

function canPlantCactus(x, z) {
  return cactusPositions.every((cactus) => Math.hypot(cactus.x - x, cactus.z - z) >= 5);
}

function generateCoalDeposits() {
  const edge = Math.floor(HALF_WORLD / COAL_VEIN_SPACING) * COAL_VEIN_SPACING;
  for (let x = -edge; x <= edge; x += COAL_VEIN_SPACING) {
    for (let z = -edge; z <= edge; z += COAL_VEIN_SPACING) {
      const depthRange = -3 - (MIN_WORLD_Y + 3);
      const y = MIN_WORLD_Y + 3 + Math.floor(hash2d(x + 409, z - 277) * depthRange);
      addCoalVein(x, y, z);
    }
  }
}

function addCoalVein(x, y, z) {
  const offsets = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
    [1, 1, 0],
    [0, -1, 0],
    [-1, 0, 1],
    [1, 0, -1]
  ];
  const blockCount = 5 + Math.floor(hash2d(x - 311, z + 563) * 6);
  const rotation = Math.floor(hash2d(x + 71, z - 193) * 4);

  for (const [offsetX, offsetY, offsetZ] of offsets.slice(0, blockCount)) {
    const [rotatedX, rotatedZ] = rotateQuarterTurn(offsetX, offsetZ, rotation);
    const blockX = x + rotatedX;
    const blockY = y + offsetY;
    const blockZ = z + rotatedZ;
    if (blockY < 0 && getBlock(blockX, blockY, blockZ) === 3) {
      setBlockRaw(blockX, blockY, blockZ, 8);
    }
  }
}

function rotateQuarterTurn(x, z, rotation) {
  if (rotation === 1) return [-z, x];
  if (rotation === 2) return [-x, -z];
  if (rotation === 3) return [z, -x];
  return [x, z];
}

function canPlaceBlock(x, y, z, id) {
  if (id !== 7) return true;

  let supportY = y - 1;
  while (getBlock(x, supportY, z) === 7) supportY -= 1;
  return getBlock(x, supportY, z) === 4;
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

function loadPigSkinTexture() {
  const texture = new THREE.TextureLoader().load("/src/assets/pig.png");
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPigMaterials(texture) {
  return {
    head: makePigBoxMaterials(texture, 0, 0, 8, 8, 8),
    snout: makePigBoxMaterials(texture, 16, 16, 4, 3, 1),
    body: makePigBoxMaterials(texture, 28, 8, 10, 16, 8),
    leg: makePigBoxMaterials(texture, 0, 16, 4, 6, 4),
    eye: new THREE.MeshLambertMaterial({ color: 0x231820 })
  };
}

function makePigBoxMaterials(texture, u, v, width, height, depth) {
  return [
    makePigAtlasMaterial(texture, u + depth + width, v + depth, depth, height),
    makePigAtlasMaterial(texture, u, v + depth, depth, height),
    makePigAtlasMaterial(texture, u + depth, v, width, depth),
    makePigAtlasMaterial(texture, u + depth + width, v, width, depth),
    makePigAtlasMaterial(texture, u + depth, v + depth, width, height),
    makePigAtlasMaterial(texture, u + depth + width + depth, v + depth, width, height)
  ];
}

function makePigAtlasMaterial(sourceTexture, u, v, width, height) {
  const texture = sourceTexture.clone();
  texture.offset.set(u / 64, 1 - (v + height) / 32);
  texture.repeat.set(width / 64, height / 32);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: texture });
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

  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const value = hash2d(x + key.length * 11, y + face.length * 17);
      const patch = color.clone().offsetHSL(0, 0, (value - 0.5) * 0.18);
      ctx.fillStyle = `#${patch.getHexString()}`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  if (key === "dirt" || (key === "grass" && face !== "top")) {
    const dirtTones =
      face === "bottom"
        ? ["#5e3b27", "#6b4329", "#795033", "#533421"]
        : ["#75472c", "#855435", "#93613b", "#684027", "#9b6740"];
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const value = hash2d(x + face.length * 29, y + key.length * 37);
        ctx.fillStyle = dirtTones[Math.floor(value * dirtTones.length) % dirtTones.length];
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  if (key === "grass" && face === "top") {
    const grassTones = ["#5f9d35", "#78ba43", "#4f8e31", "#87c64b"];
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const value = hash2d(x + 83, y - 41);
        if (value < 0.42) continue;
        ctx.fillStyle = grassTones[Math.floor(value * grassTones.length) % grassTones.length];
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  if (key === "grass" && face === "side") {
    const fringeDepths = [7, 5, 9, 6, 11, 7, 5, 9];
    ctx.fillStyle = "#70b33e";
    ctx.fillRect(0, 0, size, 5);
    for (let x = 0; x < size; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? "#65a538" : "#7bbb42";
      ctx.fillRect(x, 4, 4, fringeDepths[x / 4] - 4);
    }
    ctx.fillStyle = "#5b9633";
    ctx.fillRect(2, 8, 2, 3);
    ctx.fillRect(14, 7, 2, 4);
    ctx.fillRect(26, 8, 2, 3);
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
    ctx.fillStyle = "#8a4d29";
    for (let y = 3; y < size; y += 6) {
      ctx.fillRect(6, y, 2, 2);
      ctx.fillRect(16, y + 2, 2, 2);
      ctx.fillRect(26, y - 1, 2, 2);
    }
  }

  if (key === "wood" && face !== "side") {
    ctx.fillStyle = "#b9854e";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d09a60";
    ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = "#a96f3d";
    for (let y = 2; y < size; y += 4) {
      for (let x = 2; x < size; x += 4) {
        if (hash2d(x + 117, y - 63) > 0.46) ctx.fillRect(x, y, 2, 2);
      }
    }
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

  if (key === "cactus" && face === "side") {
    ctx.fillStyle = "#347d36";
    for (let x = 2; x < size; x += 8) ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = "#69b957";
    for (let x = 5; x < size; x += 8) ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = "#d4df91";
    for (let y = 5; y < size; y += 9) {
      ctx.fillRect(11, y, 1, 2);
      ctx.fillRect(27, y + 3, 1, 2);
    }
  }

  if (key === "cactus" && face !== "side") {
    ctx.fillStyle = "#347d36";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#69b957";
    ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = "#438f3f";
    ctx.fillRect(8, 8, 16, 16);
    ctx.fillStyle = "#80c567";
    ctx.fillRect(12, 12, 8, 8);
    ctx.fillStyle = "#58a84a";
    for (let y = 2; y < size; y += 4) {
      for (let x = 2; x < size; x += 4) {
        if (hash2d(x - 91, y + 44) > 0.56) ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  if (key === "coal") {
    const coalClusters = [
      [6, 7],
      [15, 5],
      [22, 10],
      [10, 16],
      [19, 20],
      [7, 24]
    ];
    for (const [x, y] of coalClusters) {
      ctx.fillStyle = "#4a4f50";
      ctx.fillRect(x, y, 4, 2);
      ctx.fillRect(x + 2, y + 2, 4, 2);
      ctx.fillStyle = "#303435";
      ctx.fillRect(x, y + 2, 2, 2);
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillStyle = "#191c1d";
      ctx.fillRect(x + 2, y + 2, 2, 2);
      if ((x + y) % 2 === 0) ctx.fillRect(x + 4, y, 2, 2);
    }
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
    slot.title = block.name;
    slot.innerHTML = `<canvas class="swatch" width="44" height="44"></canvas><kbd>${index + 1}</kbd>`;
    const swatch = slot.querySelector("canvas");
    if (swatch) drawHotbarBlockIcon(swatch, block.key);
    hotbar.append(slot);
  });
  updateHotbar();
}

function drawHotbarBlockIcon(swatch, key) {
  const ctx = swatch.getContext("2d");
  const topTexture = materials.get(`${key}-top`).map.image;
  const sideTexture = materials.get(`${key}-side`).map.image;
  const top = [
    [22, 3],
    [40, 12],
    [22, 21],
    [4, 12]
  ];
  const left = [
    [4, 12],
    [22, 21],
    [22, 41],
    [4, 32]
  ];
  const right = [
    [22, 21],
    [40, 12],
    [40, 32],
    [22, 41]
  ];

  ctx.clearRect(0, 0, swatch.width, swatch.height);
  drawHotbarIconFace(ctx, sideTexture, left, "rgba(0, 0, 0, 0.2)");
  drawHotbarIconFace(ctx, sideTexture, right, "rgba(0, 0, 0, 0.06)");
  drawHotbarIconFace(ctx, topTexture, top);
}

function drawHotbarIconFace(ctx, texture, corners, shade = "") {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft[0], topLeft[1]);
  ctx.lineTo(topRight[0], topRight[1]);
  ctx.lineTo(bottomRight[0], bottomRight[1]);
  ctx.lineTo(bottomLeft[0], bottomLeft[1]);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(
    (topRight[0] - topLeft[0]) / texture.width,
    (topRight[1] - topLeft[1]) / texture.width,
    (bottomLeft[0] - topLeft[0]) / texture.height,
    (bottomLeft[1] - topLeft[1]) / texture.height,
    topLeft[0],
    topLeft[1]
  );
  ctx.drawImage(texture, 0, 0);
  ctx.restore();

  if (shade) {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(topLeft[0], topLeft[1]);
    ctx.lineTo(topRight[0], topRight[1]);
    ctx.lineTo(bottomRight[0], bottomRight[1]);
    ctx.lineTo(bottomLeft[0], bottomLeft[1]);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(16, 24, 20, 0.62)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(topLeft[0] + 0.5, topLeft[1] + 0.5);
  ctx.lineTo(topRight[0] + 0.5, topRight[1] + 0.5);
  ctx.lineTo(bottomRight[0] + 0.5, bottomRight[1] + 0.5);
  ctx.lineTo(bottomLeft[0] + 0.5, bottomLeft[1] + 0.5);
  ctx.closePath();
  ctx.stroke();
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
