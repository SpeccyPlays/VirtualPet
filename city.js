import * as THREE from "three";
import { createLayout, randomAt } from "./layout.js";
import { createNavigation } from "./navigation.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Rendering consumes plain layout data. Units are approximately metres. Shared
// materials keep GPU allocations down; only owned geometry is disposed on removal.
export function createCity({ objects = [], worldSeed = 1 } = {}) {
  const layout = createLayout(worldSeed), city = new THREE.Group(), materials = new Map();
  const material = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    return materials.get(color);
  };
  function batchStatic(group, exclude = null) {
    // One Mesh normally costs one draw call. Merge static pieces with the same
    // material *within their group*, so window detail can still be hidden per
    // building and landmark/object groups retain their picking identity.
    const batches = new Map();
    for (const child of group.children) {
      if (!child.isMesh || child.isInstancedMesh || child === exclude || Array.isArray(child.material)) continue;
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(child);
    }
    for (const [sharedMaterial, parts] of batches) {
      if (parts.length < 2) continue;
      const geometries = parts.map((part) => { part.updateMatrix(); return part.geometry.clone().applyMatrix4(part.matrix); });
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((item) => item.dispose());
      if (!geometry) continue;
      const merged = new THREE.Mesh(geometry, sharedMaterial);
      merged.castShadow = parts.some((part) => part.castShadow); merged.receiveShadow = true;
      for (const part of parts) { group.remove(part); part.geometry.dispose(); }
      group.add(merged);
    }
  }
  function box(parent, w, h, d, color, x = 0, y = h / 2, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function sign(parent, text, width, y, z) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#263e43"; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#f2e3bc"; ctx.font = "bold 34px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 48, 480);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.65), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
    mesh.position.set(0, y, z); parent.add(mesh);
  }
  // Local canvas textures establish surface scale without downloaded image assets.
  function masonry(color, roof = false) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      ctx.strokeStyle = roof ? "#ffffff24" : "#d8cbb067"; ctx.lineWidth = roof ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(0, row * 16); ctx.lineTo(128, row * 16); ctx.stroke();
      for (let col = -1; col < 4; col++) { const x = col * 40 + (row % 2 ? 20 : 0); ctx.beginPath(); ctx.moveTo(x, row * 16); ctx.lineTo(x, row * 16 + 16); ctx.stroke(); }
    }
    const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2, 2); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
  }
  const bricks = [masonry("#965f4b"), masonry("#aa8162"), masonry("#b4ad92"), masonry("#7c7166")], slate = masonry("#444c55", true);
  // PlaneGeometry starts in XY; rotate it onto XZ before setting vertex heights.
  // Walkers use the same height function, keeping their feet on this surface.
  const terrain = new THREE.PlaneGeometry(216, 216, 108, 108); terrain.rotateX(-Math.PI / 2);
  const vertices = terrain.attributes.position;
  for (let i = 0; i < vertices.count; i++) vertices.setY(i, layout.heightAt(vertices.getX(i), vertices.getZ(i)) - 0.04);
  terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, material(0x7d9362)); ground.receiveShadow = true; city.add(ground);
  function ribbon(a, b, width, color) {
    const length = Math.hypot(b.x - a.x, b.z - a.z), count = Math.max(1, Math.ceil(length / 2));
    for (let i = 0; i < count; i++) {
      const x = a.x + (b.x - a.x) * (i + 0.5) / count, z = a.z + (b.z - a.z) * (i + 0.5) / count;
      const mesh = box(city, width, 0.04, length / count + 0.03, color, x, layout.heightAt(x, z) + 0.025, z);
      mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); mesh.castShadow = false;
    }
  }
  for (const road of layout.roads) {
    box(city, road.width + 4, 0.12, road.depth + 4, 0xb6afa1, road.x, 0.01, road.z);
    box(city, road.width, 0.06, road.depth, 0x4e5355, road.x, 0.1, road.z);
    const horizontal = road.width > road.depth, length = horizontal ? road.width : road.depth;
    for (let t = -length / 2 + 3; t < length / 2 - 2; t += 6) box(city, horizontal ? 2.5 : 0.12, 0.015, horizontal ? 0.12 : 2.5, 0xe0ddcd, road.x + (horizontal ? t : 0), 0.14, road.z + (horizontal ? 0 : t));
  }
  for (let z = -3.4; z <= 3.4; z += 1.1) box(city, 3, 0.02, 0.55, 0xe7e3d8, 0, 0.15, z);
  const trailNavigation = createNavigation(layout);
  for (const path of layout.paths) {
    const place = layout.landmarks.find((p) => p.x === path.a.x && p.z === path.a.z);
    const approach = { x: path.a.x, z: path.a.z + place.depth / 2 + 2 };
    const route = trailNavigation.route(path.b, approach);
    for (let i = 1; i < route.length; i++) ribbon(route[i - 1], route[i], path.width, 0xb0a28b);
  }

  const buildings = [];
  function building(plot, parent = city) {
    const group = new THREE.Group(), { width: w, depth: d, height: h } = plot;
    const brick = bricks[Math.min(3, Math.floor(plot.tone * 4))];
    // Civic buildings have an L-shaped footprint: the side wing is shorter and
    // lower than the main hall. All pieces remain inside the reserved plot.
    const winged = plot.kind === "civic";
    const mainWidth = winged ? w * 0.65 : w;
    const mainX = winged ? -w * 0.175 : 0;
    box(group, mainWidth, h, d, 0xffffff, mainX).material = brick;
    if (winged) { box(group, w * 0.35, h * 0.65, d * 0.6, 0xffffff, w * 0.325, h * 0.325, -d * 0.2).material = brick; box(group, w * 0.36, 0.2, d * 0.62, 0x51585a, w * 0.325, h * 0.65, -d * 0.2); }
    box(group, w + 0.25, 0.25, d + 0.25, 0x8b8170, 0, 0.15);
    // Extrude a triangle along Z for a gable. Hipped roofs use a scaled pyramid.
    let roof;
    if (plot.roof === "flat") {
      roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), slate); roof.position.y = h;
    } else if (plot.roof === "hip") {
      roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), slate); roof.rotation.y = Math.PI / 4;
      roof.scale.set((mainWidth + 0.7) / Math.SQRT2, 2.1, (d + 0.7) / Math.SQRT2); roof.position.set(mainX, h + 1.05, 0);
    } else {
      const triangle = new THREE.Shape(); triangle.moveTo(-mainWidth / 2 - 0.35, 0); triangle.lineTo(0, 2.2); triangle.lineTo(mainWidth / 2 + 0.35, 0); triangle.closePath();
      roof = new THREE.Mesh(new THREE.ExtrudeGeometry(triangle, { depth: d + 0.7, bevelEnabled: false }), slate); roof.position.set(mainX, h, -d / 2 - 0.35);
    }
    roof.castShadow = true; group.add(roof);
    box(group, 0.65, 2.2, 0.7, 0x825c4b, -w * 0.28, h + 1.25, -d * 0.22);
    box(group, 0.85, 0.16, 0.9, 0x514c49, -w * 0.28, h + 2.4, -d * 0.22);
    const detail = new THREE.Group(); group.add(detail);
    for (let y = plot.kind === "shop" ? 4.3 : 1.9; y < h - 0.6; y += 2.5) for (let x = -w / 2 + 1.3; x < w / 2 - 0.5; x += 2.3) for (const side of [-1, 1]) {
      if (winged && x > w * 0.15) continue;
      const z = side * (d / 2 + 0.07);
      box(detail, 1.05, 1.35, 0.12, 0xe0d8c5, x, y, z);
      box(detail, 0.85, 1.15, 0.14, 0x56757c, x, y, z + side * 0.03);
      box(detail, 0.07, 1.15, 0.17, 0xd8d5ca, x, y, z);
      box(detail, 1.16, 0.12, 0.28, 0xb4ac98, x, y - 0.72, z);
    }
    box(detail, 1.1, 2.2, 0.16, 0x314346, w * 0.28, 1.15, d / 2 + 0.03);
    if (plot.kind === "shop") {
      box(detail, w * 0.62, 1.9, 0.16, 0x4b7078, -w * 0.12, 1.2, d / 2 + 0.07);
      box(detail, w + 0.12, 0.18, 0.8, 0x3e5c52, 0, 3.1, d / 2 + 0.32);
    }
    if (plot.label) sign(detail, plot.label, w * 0.91, 2.7, d / 2 + 0.2);
    group.position.set(plot.x, layout.heightAt(plot.x, plot.z), plot.z); group.rotation.y = plot.rotation;
    batchStatic(detail); batchStatic(group);
    group.userData.detail = detail; buildings.push(group); parent.add(group); return group;
  }
  layout.plots.forEach((plot) => building(plot));
  for (const fence of layout.fences) box(city, fence.width, 0.75, fence.depth, 0x6e7950, fence.x, layout.heightAt(fence.x, fence.z) + 0.4, fence.z);
  const landmarkMeshes = new Map();
  for (const place of layout.landmarks) {
    const group = new THREE.Group(); group.name = `landmark:${place.id}`; group.position.set(place.x, layout.heightAt(place.x, place.z), place.z);
    if (place.id === "ship") {
      // The reserved footprint includes the ramp. Hull and canopy are scaled
      // spheres, keeping the craft organic rather than another box-shaped building.
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material(0x778e97));
      hull.name = "ship-hull";
      hull.scale.set(6, 1.3, 4.5); hull.position.y = 1.9; group.add(hull);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), material(0x335e68));
      canopy.scale.set(2.6, 1.6, 2.3); canopy.position.y = 2.5; group.add(canopy);
      const luminous = new THREE.MeshStandardMaterial({ color: 0x91e7c1, emissive: 0x67bba6, emissiveIntensity: 0.9, roughness: 0.35 });
      for (const x of [-4, 4]) for (const z of [-2.5, 2.5]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 10), material(0x40555d)); leg.position.set(x, 0.9, z); group.add(leg);
        box(group, 0.9, 0.15, 0.8, 0x40555d, x, 0.1, z);
      }
      for (const x of [-2.3, 0, 2.3]) {
        const engine = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), luminous); engine.position.set(x, 1.8, -3.8); group.add(engine);
      }
      box(group, 1.4, 1.7, 0.16, 0x253e48, 0, 1.7, 4.45);
      const ramp = box(group, 2.2, 0.15, 3.2, 0x879b9b, 0, 0.4, 5.8); ramp.rotation.x = 0.18;
    } else if (place.id === "observatory") {
      box(group, 8, 3, 8, 0xa4a28d);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material(0x7b9393)); dome.position.y = 3; group.add(dome);
    } else if (place.id === "old-station") {
      building({ ...place, x: 0, z: 0, width: 11, depth: 5, height: 3.6, tone: 0.1, roof: "gable", kind: "civic", rotation: 0, label: "MOORFIELD" }, group);
      for (const x of [-3, 3]) box(group, 0.1, 0.12, 16, 0x5c6260, x, 0.1, 9);
    } else if (place.id === "castle") {
      for (const x of [-5, 5]) { const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 5, 16), material(0x827f70)); tower.position.set(x, 2.5, 0); group.add(tower); }
      box(group, 9, 2.2, 1, 0x827f70, 0, 1.1, -4);
    } else if (place.id === "market") {
      for (const x of [-5, 0, 5]) { box(group, 3, 0.9, 2.5, 0x98704b, x); box(group, 3.7, 0.2, 3, x === 0 ? 0xa55f4a : 0x597c64, x, 2.4); for (const z of [-1, 1]) box(group, 0.08, 2.4, 0.08, 0x635444, x - 1.4, 1.2, z); }
    } else if (place.id === "quarry") {
      for (let i = 0; i < 4; i++) box(group, 14 - i * 2, 0.8, 3, 0x9b7b62, 0, 0.4 + i * 0.6, -4 + i * 2.5);
    } else if (place.id === "river-crossing") {
      box(group, 18, 0.16, 3.6, 0x8c7254, 0, 0.04);
      for (const z of [-1.8, 1.8]) { box(group, 18, 0.12, 0.12, 0x69533f, 0, 1.1, z); for (let x = -8; x <= 8; x += 2) box(group, 0.12, 1.1, 0.12, 0x69533f, x, 0.55, z); }
    } else if (place.id === "grove") {
      for (let i = 0; i < 9; i++) { const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), material(0x8a8c79)); stone.position.set(Math.cos(i * 0.7) * 4, 0.5, Math.sin(i * 0.7) * 4); group.add(stone); }
    }
    sign(group, place.name, 5, 2.1, place.depth / 2 + 0.4);
    batchStatic(group);
    group.traverse((child) => { child.userData.landmarkId = place.id; child.castShadow = true; child.receiveShadow = true; }); city.add(group); landmarkMeshes.set(place.id, group);
  }
  const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x597f83, roughness: 0.26, metalness: 0.25 });
  for (const area of layout.water) {
    const geometry = area.kind === "pond" ? new THREE.CircleGeometry(1, 40) : new THREE.PlaneGeometry(area.width, area.depth); geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, waterMaterial); if (area.kind === "pond") mesh.scale.set(area.width / 2, 1, area.depth / 2);
    mesh.position.set(area.x, 0.025, area.z); city.add(mesh);
  }
  // Instancing renders all trunks/crowns with just two draw calls. Each matrix
  // supplies one copy's position and scale; all copies share the same geometry.
  const treePoints = [];
  for (let i = 0; i < 430; i++) {
    const x = -103 + randomAt(worldSeed, i, 0, 71) * 206, z = -103 + randomAt(worldSeed, i, 0, 73) * 206;
    if (Math.abs(x) < 48 && Math.abs(z) < 54 || !layout.canPlace(x, z, objects) || layout.landmarks.some((p) => Math.hypot(x - p.x, z - p.z) < 13)) continue;
    treePoints.push({ x, z, scale: 1.5 + randomAt(worldSeed, i, 0, 79) * 1.6 });
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 2, 7), material(0x665443), treePoints.length);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 10, 8), material(0x456a42), treePoints.length), transform = new THREE.Object3D();
  treePoints.forEach((point, i) => {
    transform.position.set(point.x, layout.heightAt(point.x, point.z) + point.scale, point.z); transform.scale.setScalar(point.scale); transform.updateMatrix(); trunks.setMatrixAt(i, transform.matrix);
    transform.position.y += point.scale * 1.2; transform.scale.set(point.scale, point.scale * 1.35, point.scale); transform.updateMatrix(); crowns.setMatrixAt(i, transform.matrix);
  });
  trunks.castShadow = crowns.castShadow = true; city.add(trunks, crowns);
  const objectMeshes = new Map();
  function addObject(object) {
    if (objectMeshes.has(object.id)) removeObject(object.id);
    const group = new THREE.Group();
    if (object.type === "bench") { box(group, 1.8, 0.15, 0.55, 0x8c6847, 0, 0.55); box(group, 1.8, 0.55, 0.12, 0x8c6847, 0, 0.85, -0.2); for (const x of [-0.7, 0.7]) box(group, 0.12, 0.6, 0.5, 0x353f3c, x, 0.3); }
    else if (object.type === "phonebox") { box(group, 0.85, 2.1, 0.8, 0xb44339); box(group, 0.62, 1.3, 0.05, 0x789c9b, 0, 1.25, 0.42); }
    else if (object.type === "litterbin") box(group, 0.6, 0.85, 0.6, 0x3c4e46);
    else { if (object.type === "tree") box(group, 0.25, 2.4, 0.25, 0x665443); const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), material(0x4c7548)); foliage.position.y = object.type === "tree" ? 2.3 : 0.6; group.add(foliage); }
    group.position.set(object.x, layout.heightAt(object.x, object.z), object.z); group.traverse((child) => { child.userData.objectId = object.id; }); objectMeshes.set(object.id, group); city.add(group);
    layout.obstacles.push({ id: `object:${object.id}`, x: object.x, z: object.z, width: object.type === "bench" ? 1.8 : 0.7, depth: object.type === "bench" ? 0.7 : 0.7 });
  }
  function removeObject(id) {
    const mesh = objectMeshes.get(id); if (!mesh) return;
    mesh.traverse((child) => child.geometry?.dispose()); city.remove(mesh); objectMeshes.delete(id);
    const index = layout.obstacles.findIndex((item) => item.id === `object:${id}`);
    if (index >= 0) layout.obstacles.splice(index, 1);
  }
  // Preserve legacy objects, relocating only those now inside a building/road.
  const placed = [];
  for (const object of objects) {
    if (!layout.canPlace(object.x, object.z, placed)) {
      let found = false;
      const ox = Math.max(-102, Math.min(102, object.x)), oz = Math.max(-102, Math.min(102, object.z));
      for (let radius = 0; radius <= 210 && !found; radius += 2) for (let i = 0; i < 32 && !found; i++) {
        const x = ox + Math.cos(i / 32 * Math.PI * 2) * radius, z = oz + Math.sin(i / 32 * Math.PI * 2) * radius;
        if (layout.canPlace(x, z, placed)) { object.x = Math.round(x * 10) / 10; object.z = Math.round(z * 10) / 10; found = true; }
      }
    }
    placed.push(object); addObject(object);
  }
  batchStatic(city, ground);
  function updateDetails(camera, distance = 125) {
    for (const group of buildings) group.userData.detail.visible = camera.position.distanceToSquared(group.getWorldPosition(transform.position)) < distance * distance;
  }
  return { city, ground, layout, cameraObstacles: buildings, objectMeshes, addObject, removeObject, updateDetails, getObjectPosition: (id) => objectMeshes.get(id)?.position, landmarkMeshes, landmarks: layout.landmarks, worldBounds: layout.bounds };
}
