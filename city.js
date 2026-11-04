import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// Build Wychmere's wider region. The scene is intentionally low-poly, but each
// district has a different shape and palette so it remains readable at a distance.
export function createCity({ objects = [], worldSeed = 1 } = {}) {
  const city = new THREE.Group();
  const material = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(216, 0.18, 216), material(0x789b83));
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  city.add(ground);

  const box = (width, height, depth, color, x, z, y = height / 2, group = city) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const strip = (width, depth, color, x, z, y = 0.02) => box(width, 0.05, depth, color, x, z, y);
  const road = (x, z, width, depth, horizontal = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), material(0x414c58));
    mesh.position.set(x, 0.02, z); mesh.receiveShadow = true; city.add(mesh); return mesh;
  };
  const path = (x, z, width, depth, horizontal = true) => strip(width, depth, 0xb9b29f, x, z, 0.055);

  // A connected road network ties the city centre to the villages and nature areas.
  road(0, 0, 82, 10); road(0, -20, 120, 7); road(0, 21, 118, 7);
  road(-36, 0, 7, 48, false); road(36, 0, 7, 48, false); road(0, 40, 7, 38, false); road(0, -39, 7, 34, false);
  for (let x = -37; x <= 37; x += 4) strip(1.8, 0.08, 0xf0eee1, x, 0, 0.075);
  for (const z of [-4.72, 4.72]) { strip(80, 0.08, 0xe4bf52, 0, z - 0.16, 0.08); strip(80, 0.08, 0xe4bf52, 0, z + 0.16, 0.08); }
  path(0, 10, 82, 2.2); path(0, -10, 82, 2.2); path(0, 31, 70, 2.4); path(-51, -1, 2.4, 32, false); path(51, -1, 2.4, 32, false);

  function signTexture(text) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
    const context = canvas.getContext("2d"); context.fillStyle = "#fff7dd"; context.fillRect(0, 0, 512, 96);
    context.fillStyle = "#1f2d35"; context.font = "bold 30px Arial"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 256, 48, 480);
    return new THREE.CanvasTexture(canvas);
  }
  function building(x, z, width, depth, height, color, label = "") {
    const group = new THREE.Group();
    group.add(box(width, height, depth, color, 0, 0, height / 2, group));
    for (let floor = 0; floor < Math.max(1, Math.floor(height / 1.5) - 1); floor += 1) {
      for (let index = 0; index < Math.max(1, Math.floor(width / 1.2)); index += 1) box(0.34, 0.4, 0.04, 0xf5d58d, -width / 2 + 0.7 + index * 1.15, depth / 2 + 0.02, 1.9 + floor * 1.35, group);
    }
    if (label) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.42, 0.08), new THREE.MeshStandardMaterial({ color: 0xe5c45d, map: signTexture(label) }));
      sign.position.set(0, Math.min(height - 0.7, 1.6), depth / 2 + 0.05); group.add(sign);
    }
    group.position.set(x, 0, z); group.traverse((child) => { child.castShadow = true; child.receiveShadow = true; }); city.add(group);
  }

  // Central Wychmere: shops, civic buildings, and a compact town square.
  [[-29, "Supermarket", 0x8d5148], [-22, "Betting Shop", 0x657987], [-15, "Golden Kebab", 0x9a654e], [-8, "Planet Pizza", 0x7d5967], [0, "Town Grocers", 0xa4765d], [8, "Fresh Market", 0x5d7682], [16, "Chicken & Chips", 0x8b5753], [24, "News & Snacks", 0x6f7f86]]
    .forEach(([x, label, color]) => building(x, -8.8, 6.5, 4.4, 5.5, color, label));
  [[-27, "Library", 0x657987], [-18, "Civic Hall", 0x8d6a58], [-8, "Post Office", 0x7b6170], [3, "Museum", 0x6c7e89], [14, "Market Hall", 0x98564b], [25, "Station", 0x59727d]]
    .forEach(([x, label, color]) => building(x, 8.8, 7.5, 4.4, 6, color, label));
  box(13, 0.15, 13, 0xa7b694, 0, 17.5, 0.08); path(0, 17.5, 13, 1.4); path(0, 17.5, 1.4, 13, false); box(1.2, 2.4, 1.2, 0x87aeb0, 0, 17.5, 1.2);

  function tree(x, z, scale = 1, color = 0x3c7d69, parent = city) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.35 * scale, 7), material(0x654d43)); trunk.position.y = 0.68 * scale;
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 * scale, 0), material(color)); crown.position.y = 1.55 * scale;
    group.add(trunk, crown); group.position.set(x, 0, z); group.traverse((child) => { child.castShadow = true; }); parent.add(group);
  }
  function village(x, z, name, accent) {
    box(16, 0.12, 13, 0xb1a98e, x, z, 0.08); path(x, z, 15, 1.5);
    [[-5, -3], [4, -3], [-4, 3], [5, 3]].forEach(([dx, dz], index) => building(x + dx, z + dz, 5.2, 4, 2.8, index % 2 ? 0xb37d62 : 0x9b6f52));
    box(5, 3.6, 4, accent, x, z - 5, 1.8); const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xe5c45d, map: signTexture(name) })); sign.position.set(x, 2.6, z - 2.95); city.add(sign);
    tree(x - 8, z - 5, 0.85); tree(x + 8, z + 5, 0.85);
  }
  village(-50, -28, "Moorfield", 0x6c7e89); village(48, -29, "Larkspur", 0x8b6655); village(48, 35, "Brackenford", 0x687e63);

  // North-west forest and north-east public park are deliberately more open.
  for (let x = -64; x <= -30; x += 7) for (let z = 22; z <= 51; z += 7) if ((x + z) % 3 !== 0) tree(x, z, 0.8 + ((x - z) % 3) * 0.05, 0x2f6b55);
  box(31, 0.1, 27, 0x9cb58e, 42, 11, 0.08); path(42, 11, 26, 1.6); path(42, 11, 1.6, 24, false);
  for (const [x, z] of [[31, 2], [53, 2], [31, 21], [53, 21], [42, 24]]) tree(x, z, 0.9, 0x4c8763);
  box(3.2, 2.8, 2.8, 0xc18c62, 42, 11, 1.4); const parkSign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xe5c45d, map: signTexture("Wychmere Park") })); parkSign.position.set(42, 2.3, 9.55); city.add(parkSign);
  for (let x = -34; x <= 34; x += 8) { tree(x, -6.6, 0.65); tree(x, 6.6, 0.65); }

  // Deterministic chunk generation makes the larger world feel discovered rather
  // than hand-placed. The seed is saved by app.js, so these chunks are identical
  // every time this browser loads the same Juniper world.
  const seed = Number(worldSeed) >>> 0;
  const chunkSize = 24;
  const chunkRadius = 4;
  const generatedChunks = new Map();
  const randomAt = (x, z, salt = 0) => {
    let value = Math.imul((x | 0) ^ seed, 374761393) + Math.imul((z | 0) ^ salt, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x4e9aa0, roughness: 0.25, transparent: true, opacity: 0.82 });
  function generatedCabin(parent, x, z, color) {
    const cabin = new THREE.Group();
    box(4.2, 2.3, 3.8, color, 0, 0, 1.15, cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.3, 4), material(0x5b4640));
    roof.position.y = 2.95; roof.rotation.y = Math.PI / 4; cabin.add(roof);
    box(0.45, 0.95, 0.06, 0x26343b, 0, -1.93, 0.5, cabin);
    box(0.55, 0.48, 0.06, 0x9bd6c0, -1.15, -1.94, 1.25, cabin);
    cabin.position.set(x, 0, z); cabin.traverse((child) => { child.castShadow = true; child.receiveShadow = true; }); parent.add(cabin);
  }
  function ruin(parent, x, z) {
    for (const [dx, dz, height] of [[-1.2, -0.8, 2.1], [1.1, -0.6, 1.4], [0.2, 1.1, 1.8]]) box(0.55, height, 0.55, 0x74746b, x + dx, z + dz, height / 2, parent);
  }
  function generatedChunk(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`;
    if (generatedChunks.has(key)) return;
    const chunk = new THREE.Group();
    chunk.position.set(chunkX * chunkSize, 0, chunkZ * chunkSize);
    const centerX = chunkX * chunkSize;
    const centerZ = chunkZ * chunkSize;
    const centralDistrict = Math.abs(centerX) < 48 && Math.abs(centerZ) < 24;
    const roll = randomAt(chunkX, chunkZ, 11);
    const forest = (centerX < -30 && centerZ > 24) || roll > 0.67;
    const lake = !centralDistrict && roll < 0.08 && Math.abs(centerX) > 42;
    const height = centralDistrict ? 0.08 : 0.18 + randomAt(chunkX, chunkZ, 17) * 0.65;
    const terrainColor = forest ? 0x507c5c : 0x789b83;
    box(chunkSize, height, chunkSize, terrainColor, 0, 0, height / 2 - 0.04, chunk);
    if (lake) {
      const water = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 18), waterMaterial);
      water.position.y = height + 0.08; chunk.add(water);
      for (let rock = 0; rock < 5; rock += 1) {
        const angle = randomAt(chunkX + rock, chunkZ, 23) * Math.PI * 2;
        const radius = 8 + randomAt(chunkX, chunkZ + rock, 29) * 3;
        box(0.7, 0.35, 0.7, 0x68736e, Math.cos(angle) * radius, Math.sin(angle) * radius, height + 0.16, chunk);
      }
    } else if (forest) {
      const treeCount = 8 + Math.floor(randomAt(chunkX, chunkZ, 31) * 9);
      for (let index = 0; index < treeCount; index += 1) {
        const x = -10 + randomAt(chunkX * 31 + index, chunkZ, 37) * 20;
        const z = -10 + randomAt(chunkX, chunkZ * 31 + index, 41) * 20;
        tree(x, z, 0.65 + randomAt(index, chunkX + chunkZ, 43) * 0.5, index % 3 ? 0x2f6b55 : 0x3f805f, chunk);
      }
      if (randomAt(chunkX, chunkZ, 47) > 0.78) ruin(chunk, -2, 2);
    } else {
      const treeCount = 1 + Math.floor(randomAt(chunkX, chunkZ, 53) * 4);
      for (let index = 0; index < treeCount; index += 1) {
        const x = -10 + randomAt(chunkX * 17 + index, chunkZ, 59) * 20;
        const z = -10 + randomAt(chunkX, chunkZ * 17 + index, 61) * 20;
        tree(x, z, 0.55 + randomAt(index, chunkX, 67) * 0.3, 0x4c8763, chunk);
      }
      if (randomAt(chunkX, chunkZ, 71) > 0.78) generatedCabin(chunk, -3, 2, 0x9b6f52);
      if (randomAt(chunkX, chunkZ, 73) > 0.9) ruin(chunk, 3, -3);
    }
    chunk.traverse((child) => { child.receiveShadow = true; });
    generatedChunks.set(key, chunk);
    city.add(chunk);
  }
  for (let chunkX = -chunkRadius; chunkX <= chunkRadius; chunkX += 1) {
    for (let chunkZ = -chunkRadius; chunkZ <= chunkRadius; chunkZ += 1) generatedChunk(chunkX, chunkZ);
  }

  const landmarkMeshes = new Map();
  const landmarks = [];
  function landmarkSign(parent, text, x = 0, z = 0) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 0.08), new THREE.MeshStandardMaterial({ color: 0xe5c45d, map: signTexture(text) }));
    sign.position.set(x, 2.3, z); parent.add(sign);
  }
  function landmark(id, name, description, x, z, build) {
    const group = new THREE.Group();
    group.userData.landmarkId = id;
    build(group);
    group.position.set(x, 0, z);
    group.traverse((child) => { child.userData.landmarkId = id; child.castShadow = true; child.receiveShadow = true; });
    landmarkMeshes.set(id, group);
    landmarks.push({ id, name, description, x, z });
    city.add(group);
  }
  landmark("observatory", "Wychmere Observatory", "A hilltop dome where Juniper can study the sky and compare it with the stars she remembers.", 72, 72, (group) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), material(0x6f8d9b)); dome.position.y = 4; group.add(dome);
    box(8, 3, 8, 0x8d9d95, 0, 0, 1.5, group); box(1.2, 2.8, 1.2, 0x26343b, 0, -4.05, 1.4, group); landmarkSign(group, "OBSERVATORY", 0, -4.1);
  });
  landmark("quarry", "Redstone Quarry", "A deep quarry wall exposes layers of stone, old machinery, and evidence of patient geological time.", -78, -66, (group) => {
    box(15, 1.2, 12, 0x8a6551, 0, 0, 0.6, group); box(2.5, 3, 2.5, 0x5b5d58, -4, -2, 1.5, group); box(2.5, 2, 2.5, 0x5b5d58, 4, 3, 1, group); landmarkSign(group, "REDSTONE QUARRY", 0, -6.1);
  });
  landmark("old-station", "Old Moorfield Station", "A quiet rural station with a closed ticket office and rails leading toward the city.", -72, 48, (group) => {
    box(11, 2.8, 4.2, 0x8d6a58, 0, 0, 1.4, group); box(5, 0.25, 6, 0x5b4640, 0, 0, 3, group); landmarkSign(group, "OLD STATION", 0, -2.15); path(-8, 0, 14, 1.2); path(8, 0, 14, 1.2);
  });
  landmark("wetlands", "Southmere Wetlands", "A broad wetland where reeds, birds, and shallow water make a living boundary around the region.", 70, -72, (group) => {
    const water = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 12), waterMaterial); water.position.y = 0.18; group.add(water);
    for (let index = -6; index <= 6; index += 3) { const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 5), material(0x688c5b)); reed.position.set(index, 0.65, 6); group.add(reed); }
    landmarkSign(group, "SOUTHMERE WETLANDS", 0, -6.1);
  });
  landmark("castle", "Brackenford Castle Ruins", "Broken walls overlook the northern road. Humans built here for protection; now the stones shelter moss and birds.", -72, 72, (group) => {
    box(1.4, 6, 1.4, 0x74746b, -5, 0, 3, group); box(1.4, 4, 1.4, 0x74746b, 5, 1, 2, group); box(12, 1, 1.2, 0x74746b, 0, -5, 0.5, group); landmarkSign(group, "CASTLE RUINS", 0, -5.8);
  });
  landmark("market", "Larkspur Market", "A weekly market square where food, tools, gossip, and local stories travel between villages.", 72, -20, (group) => {
    box(14, 0.12, 12, 0xb1a98e, 0, 0, 0.08, group); for (const x of [-5, 0, 5]) { box(3.2, 2.2, 2.4, 0xc18c62, x, 0, 1.1, group); box(3.6, 0.25, 2.8, 0x6c7e89, x, 0, 2.35, group); } landmarkSign(group, "LARKSPUR MARKET", 0, -6.1);
  });
  landmark("grove", "Moonlit Grove", "An old circle of trees where the forest is unusually quiet and Juniper's sensors detect faint repeating signals.", -42, 78, (group) => {
    for (let index = 0; index < 7; index += 1) tree(Math.cos(index / 7 * Math.PI * 2) * 6, Math.sin(index / 7 * Math.PI * 2) * 6, 1.15, 0x2f6b55, group);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.35, 8), material(0x68736e)); stone.position.y = 0.18; group.add(stone); landmarkSign(group, "MOONLIT GROVE", 0, -8);
  });
  landmark("river-crossing", "River Crossing", "A footbridge crosses the river running south of Wychmere and offers a clear view of the surrounding settlements.", 0, -78, (group) => {
    box(18, 0.35, 2.4, 0x79543f, 0, 0, 1.1, group); for (const x of [-8, 8]) { box(0.18, 1.4, 0.18, 0x26333b, x, -0.9, 0.75, group); box(0.18, 1.4, 0.18, 0x26333b, x, 0.9, 0.75, group); } landmarkSign(group, "RIVER CROSSING", 0, -2.2);
  });

  // User-editable objects keep the same contract used by app.js and the server.
  const objectMeshes = new Map();
  function createObjectMesh(object) {
    const group = new THREE.Group(); group.userData.objectId = object.id;
    if (object.type === "bench") { box(1.8, 0.16, 0.42, 0x9b6f52, 0, 0, 0.55, group); box(1.8, 0.55, 0.12, 0x79543f, 0, -0.16, 0.82, group); [-0.65, 0.65].forEach((x) => box(0.12, 0.55, 0.12, 0x26333b, x, 0, 0.27, group)); }
    else if (object.type === "phonebox") { box(0.85, 2.05, 0.75, 0xc93632, 0, 0, 1.03, group); box(0.58, 0.9, 0.04, 0xb8d0ca, 0, 0.39, 1.4, group); }
    else if (object.type === "litterbin") { box(0.55, 0.75, 0.55, 0x4d5a5c, 0, 0, 0.38, group); box(0.72, 0.08, 0.72, 0x26333b, 0, 0, 0.8, group); }
    else if (object.type === "tree") { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.35, 7), material(0x654d43)); trunk.position.y = 0.68; const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), material(0x3c7d69)); crown.position.y = 1.55; group.add(trunk, crown); }
    else if (object.type === "bush") { const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), material(0x3e705b)); bush.scale.set(1.25, 0.7, 0.8); bush.position.y = 0.48; group.add(bush); }
    group.position.set(object.x, 0, object.z); group.traverse((child) => { child.userData.objectId = object.id; child.castShadow = true; child.receiveShadow = true; }); return group;
  }
  function addObject(object) { const mesh = createObjectMesh(object); objectMeshes.set(object.id, mesh); city.add(mesh); }
  function removeObject(id) { const mesh = objectMeshes.get(id); if (!mesh) return; city.remove(mesh); objectMeshes.delete(id); }
  function getObjectPosition(id) { return objectMeshes.get(id)?.position || null; }
  objects.forEach(addObject);
  return { city, ground, objectMeshes, addObject, removeObject, getObjectPosition, landmarkMeshes, landmarks, worldBounds: { minX: -108, maxX: 108, minZ: -108, maxZ: 108 } };
}
