import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

export function createCity({ objects = [] } = {}) {
  const city = new THREE.Group();
  const material = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(70, 0.18, 56), material(0x7fa39d));
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  city.add(ground);

  for (const [width, depth, x, z] of [[62, 9, 0, 0]]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), material(0x495764));
    road.position.set(x, 0.02, z);
    road.receiveShadow = true;
    city.add(road);
  }
  for (const [x, z, width, depth] of [[0, 5.5, 62, 1.1], [0, -5.5, 62, 1.1], [-5.5, 0, 1.1, 48], [5.5, 0, 1.1, 48]]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), material(0xc6beb0));
    sidewalk.position.set(x, 0.05, z);
    sidewalk.receiveShadow = true;
    city.add(sidewalk);
  }

  const roadMarkMaterial = material(0xe7d8a0);
  for (let x = -28; x <= 28; x += 4) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.045, 0.08), roadMarkMaterial);
    mark.position.set(x, 0.055, 0);
    city.add(mark);
  }
  function crosswalk(x, z, horizontal = true) {
    for (let index = -2; index <= 2; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.35 : 4.2, 0.05, horizontal ? 4.2 : 0.35), roadMarkMaterial);
      stripe.position.set(x + (horizontal ? index * 0.8 : 0), 0.06, z + (horizontal ? 0 : index * 0.8));
      city.add(stripe);
    }
  }
  crosswalk(0, 0);
  const yellowLineMaterial = material(0xe2b94f);
  function doubleYellowLine(horizontal, fixed, from, to) {
    for (const offset of [-0.16, 0.16]) {
      const line = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(to - from, 0.045, 0.08) : new THREE.BoxGeometry(0.08, 0.045, to - from), yellowLineMaterial);
      line.position.set(horizontal ? (from + to) / 2 : fixed + offset, 0.07, horizontal ? fixed + offset : (from + to) / 2);
      city.add(line);
    }
  }
  doubleYellowLine(true, -4.65, -28, 28);
  doubleYellowLine(true, 4.65, -28, 28);

  function building(x, z, width, depth, height, color) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
    base.position.y = height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 0.45, 4), material(0x7b6571));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = height + 0.23;
    group.add(roof);
    for (let floor = 0; floor < Math.floor(height / 1.15); floor += 1) {
      for (let side = 0; side < Math.max(1, Math.floor(width / 0.8)); side += 1) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.025), material(0xf3d388, 0.35));
        window.position.set(-width / 2 + 0.5 + side * 0.75, 0.55 + floor * 1.15, depth / 2 + 0.014);
        group.add(window);
      }
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.04), material(0x26333b));
    door.position.set(0, 0.39, depth / 2 + 0.025);
    group.add(door);
    group.position.set(x, 0, z);
    city.add(group);
  }
  function terracedRow(startX, z, count, colors, height = 4.4) {
    for (let index = 0; index < count; index += 1) building(startX + index * 3.05, z, 2.9, 4.8, height + (index % 2) * 0.35, colors[index % colors.length]);
  }
  terracedRow(-24, -11, 8, [0x9b493d, 0xa95443, 0x874237], 4.3);
  terracedRow(2, -11, 8, [0x9b493d, 0xa95443, 0x874237], 4.5);
  terracedRow(-24, 11, 8, [0x9b493d, 0xa95443, 0x874237], 4.2);
  terracedRow(2, 11, 8, [0x9b493d, 0xa95443, 0x874237], 4.4);
  building(-12, -11, 5.6, 5, 5.4, 0x6c3832);
  building(14, 11, 5.6, 5, 5.2, 0x6c3832);

  function tree(x, z, scale = 0.9) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 1.1 * scale, 7), material(0x654d43));
    trunk.position.set(x, 0.55 * scale, z);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62 * scale, 0), material(0x3c7d69));
    crown.position.set(x, 1.3 * scale, z);
    crown.castShadow = true;
    city.add(trunk, crown);
  }
  [[-12, 4.5], [-10, 7], [-13, 7], [-1.5, 13], [1.6, 13], [-1.5, -12], [1.5, -12], [-25, 12], [25, -12]].forEach((point) => tree(...point));

  function parkedCar(x, z, color, rotation = 0) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.3, 2.5), material(color, 0.65));
    body.position.y = 0.22;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.38, 1.2), material(0x9fb8bd, 0.3));
    cabin.position.set(0, 0.5, -0.1);
    car.add(body, cabin);
    car.position.set(x, 0, z);
    car.rotation.y = rotation;
    car.traverse((child) => { child.castShadow = true; });
    city.add(car);
  }
  parkedCar(-15.2, -17.4, 0xc96f68, Math.PI / 2);
  parkedCar(-11.8, -17.4, 0x7b9fd0, Math.PI / 2);
  parkedCar(15.2, 17.4, 0xd4a75e, -Math.PI / 2);
  parkedCar(11.8, 17.4, 0x8fb894, -Math.PI / 2);
  function hedge(x, z, width, depth = 0.35) {
    const shrub = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, depth), material(0x3e705b));
    shrub.position.set(x, 0.28, z);
    shrub.castShadow = true;
    city.add(shrub);
  }
  hedge(-16.5, -7.9, 8.5);
  hedge(11, -7.9, 8.5);
  hedge(-16.5, 7.9, 8.5);
  hedge(11, 7.9, 8.5);
  const pubSign = new THREE.Group();
  const pubPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), material(0x26333b));
  const pubBoard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.08), material(0x315f55));
  pubPost.position.y = 0.75;
  pubBoard.position.y = 1.55;
  pubSign.add(pubPost, pubBoard);
  pubSign.position.set(-12, 0, -7.9);
  city.add(pubSign);
  const busStop = new THREE.Group();
  const shelter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.08), material(0x91a8a8, 0.35));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.1), material(0x26333b));
  shelter.position.set(0, 0.9, 0);
  roof.position.set(0, 1.85, -0.2);
  busStop.add(shelter, roof);
  busStop.position.set(16, 0, -8);
  city.add(busStop);
  const busStopFlag = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), material(0x26333b));
  const busStopRoundel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), material(0xd84f45));
  busStopFlag.position.set(17.5, 0.9, -8);
  busStopRoundel.position.set(17.5, 1.85, -8);
  busStopRoundel.rotation.x = Math.PI / 2;
  city.add(busStopFlag, busStopRoundel);

  const park = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), material(0x75a984));
  park.rotation.x = -Math.PI / 2;
  park.position.set(-11, 0.07, 5.8);
  city.add(park);
  function lamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.3, 6), material(0x26333b));
    pole.position.set(x, 1.2, z);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), material(0xffdfa0));
    light.position.set(x, 2.45, z);
    city.add(pole, light);
  }
  [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]].forEach((point) => lamp(...point));
  const objectMeshes = new Map();
  function createObjectMesh(object) {
    const group = new THREE.Group();
    group.userData.objectId = object.id;
    const objectMaterial = (color, roughness = 1) => material(color, roughness);
    if (object.type === "bench") {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.42), objectMaterial(0x9b6f52));
      seat.position.y = 0.55;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.12), objectMaterial(0x79543f));
      back.position.set(0, 0.82, -0.16);
      [-0.65, 0.65].forEach((x) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), objectMaterial(0x26333b)); leg.position.set(x, 0.27, 0); group.add(leg); });
      group.add(seat, back);
    } else if (object.type === "garden") {
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.35), objectMaterial(0x72533f));
      soil.position.y = 0.08;
      group.add(soil);
      [[-0.7, 0.25], [0, -0.25], [0.7, 0.2], [0.25, 0.35]].forEach(([x, z], index) => { const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), objectMaterial([0xe99aaf, 0xf5d27d, 0xbba8f2, 0x91e7c1][index])); flower.position.set(x, 0.42, z); group.add(flower); });
    } else if (object.type === "birdhouse") {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 6), objectMaterial(0x654d43));
      pole.position.y = 0.85;
      const house = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.65), objectMaterial(0xc98270));
      house.position.y = 1.7;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.42, 4), objectMaterial(0x7b6571));
      roof.position.y = 2.28;
      roof.rotation.y = Math.PI / 4;
      group.add(pole, house, roof);
    } else if (object.type === "lantern") {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.8, 6), objectMaterial(0x26333b));
      pole.position.y = 0.9;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), objectMaterial(0xffdfa0, 0.35));
      glow.position.y = 1.95;
      group.add(pole, glow);
    } else if (object.type === "sculpture") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.25, 8), objectMaterial(0xb5b8ae));
      const shape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), objectMaterial(0xc4b4ff, 0.65));
      base.position.y = 0.13;
      shape.position.y = 0.75;
      group.add(base, shape);
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 16), objectMaterial(0xb5b8ae));
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 16), objectMaterial(0x70b8c2, 0.25));
      base.position.y = 0.16;
      water.position.y = 0.27;
      group.add(base, water);
    }
    group.position.set(object.x, 0, object.z);
    group.traverse((child) => { child.userData.objectId = object.id; child.castShadow = true; child.receiveShadow = true; });
    return group;
  }
  function addObject(object) { const mesh = createObjectMesh(object); objectMeshes.set(object.id, mesh); city.add(mesh); }
  function removeObject(id) { const mesh = objectMeshes.get(id); if (!mesh) return; city.remove(mesh); objectMeshes.delete(id); }
  function getObjectPosition(id) { return objectMeshes.get(id)?.position || null; }
  objects.forEach(addObject);
  return { city, ground, objectMeshes, addObject, removeObject, getObjectPosition };
}
