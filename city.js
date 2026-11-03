import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// Build the fixed Wychmere high street and the user-editable street objects.
export function createCity({ objects = [] } = {}) {
  const city = new THREE.Group();
  const material = (color, roughness = 1, emissive = 0) => new THREE.MeshStandardMaterial({
    color,
    roughness,
    emissive,
    emissiveIntensity: emissive ? 0.4 : 0,
  });

  // Base terrain, a straight two-lane road, and continuous pavements.
  const ground = new THREE.Mesh(new THREE.BoxGeometry(70, 0.18, 56), material(0x8ba99a));
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  city.add(ground);
  const road = new THREE.Mesh(new THREE.BoxGeometry(66, 0.04, 10), material(0x414c58));
  road.position.y = 0.02;
  road.receiveShadow = true;
  city.add(road);
  for (const z of [-6, 6]) {
    const pavement = new THREE.Mesh(new THREE.BoxGeometry(66, 0.08, 1.6), material(0xc7c0b3));
    pavement.position.set(0, 0.05, z);
    pavement.receiveShadow = true;
    city.add(pavement);
  }

  // UK road markings: centre line, double yellow kerb lines, and a zebra crossing.
  const white = material(0xf0eee1);
  const yellow = material(0xe4bf52);
  for (let x = -30; x <= 30; x += 4) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.045, 0.08), white);
    dash.position.set(x, 0.055, 0);
    city.add(dash);
  }
  for (const z of [-4.72, 4.72]) {
    for (const offset of [-0.16, 0.16]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(64, 0.045, 0.08), yellow);
      line.position.set(0, 0.065, z + offset);
      city.add(line);
    }
  }
  for (let index = -3; index <= 3; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 9.2), white);
    stripe.position.set(index * 0.8, 0.07, 0);
    city.add(stripe);
  }

  // Render simple readable shop signs without adding an external font asset.
  function signTexture(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff7dd";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1f2d35";
    context.font = "bold 30px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, 480);
    return new THREE.CanvasTexture(canvas);
  }

  // Reusable apartment-above-shop block with a coloured UK storefront sign.
  function highStreetUnit(x, z, width, height, facade, shopColor, signColor, label) {
    const group = new THREE.Group();
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 4.4), material(facade));
    building.position.y = height / 2;
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    const shopfront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 1.25, 0.08), material(shopColor, 0.35));
    shopfront.position.set(0, 0.75, 2.23);
    group.add(shopfront);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.42, 0.1), new THREE.MeshStandardMaterial({ color: signColor, roughness: 0.4, map: signTexture(label) }));
    sign.position.set(0, 1.55, 2.25);
    group.add(sign);

    const floors = Math.max(1, Math.floor((height - 1.9) / 1.35));
    for (let floor = 0; floor < floors; floor += 1) {
      const count = Math.max(1, Math.floor(width / 1.1));
      for (let windowIndex = 0; windowIndex < count; windowIndex += 1) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.04), material(0xf5d58d, 0.35));
        window.position.set(-width / 2 + 0.65 + windowIndex * 1.05, 2.25 + floor * 1.35, 2.23);
        group.add(window);
      }
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.08), material(0x26343b));
    door.position.set(width * 0.3, 0.55, 2.25);
    group.add(door);
    // The label is kept as metadata for future sign text rendering.
    group.userData.shopLabel = label;
    group.position.set(x, 0, z);
    city.add(group);
  }

  // Distinct shops on each side of the single straight high street.
  const shopRows = [
    [-25, -9.2, 5.4, 5.5, 0x8d5148, 0x315f55, 0xb84d43, "Wychmere Supermarket"],
    [-18.5, -9.2, 5.4, 5.5, 0x657987, 0x303b4e, 0xe0b14f, "Odds & Ends Betting"],
    [-11.5, -9.2, 5.4, 5.5, 0x9a654e, 0x374c58, 0xe6a64a, "The Golden Kebab"],
    [-4.5, -9.2, 5.4, 5.5, 0x7d5967, 0x294f63, 0xd65a48, "Planet Pizza"],
    [3.5, -9.2, 5.8, 5.5, 0xa4765d, 0x6b493b, 0xe5c45d, "Wychmere Grocers"],
    [11, -9.2, 5.8, 5.5, 0x5d7682, 0x2e5960, 0x91e7c1, "Fresh Market"],
    [19, -9.2, 5.8, 5.5, 0x8b5753, 0x4e3138, 0xd9a0aa, "Chicken & Chips"],
    [-22, 9.2, 6.4, 5.2, 0x6c7e89, 0x334c56, 0x91e7c1, "Wychmere Supermarket"],
    [-14, 9.2, 5.6, 5.2, 0x98564b, 0x423846, 0xe0b14f, "Lucky Star Betting"],
    [-6.5, 9.2, 5.6, 5.2, 0x7b6170, 0x4c3035, 0xf0c16c, "Bella Pizza"],
    [1, 9.2, 5.6, 5.2, 0xa26d4f, 0x374d55, 0xe6a64a, "The Doner House"],
    [9, 9.2, 5.8, 5.2, 0x59727d, 0x2f5360, 0x91e7c1, "Corner Shop"],
    [17, 9.2, 5.8, 5.2, 0x85534d, 0x4f3139, 0xd9a0aa, "Wychmere Bargains"],
    [25, 9.2, 4.4, 5.2, 0x6f7f86, 0x34414c, 0xe0b14f, "News & Snacks"],
  ];
  shopRows.forEach((unit) => highStreetUnit(...unit));

  // Evenly spaced UK-style street lamps, parked cars, and a bus stop.
  function streetLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.8, 6), material(0x26333b));
    pole.position.set(x, 1.4, z);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.28), material(0xffdfa0, 0.35, 0xffdfa0));
    head.position.set(x, 2.85, z);
    city.add(pole, head);
  }
  for (let x = -28; x <= 28; x += 8) {
    streetLamp(x, -6.75);
    streetLamp(x, 6.75);
  }
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
  [-27, -21, -15, 18, 24].forEach((x, index) => parkedCar(x, -4.05, [0xc96f68, 0x7b9fd0, 0xd4a75e, 0x8fb894, 0x8b647d][index], Math.PI / 2));
  [-24, -18, 13, 19, 25].forEach((x, index) => parkedCar(x, 4.05, [0x7b9fd0, 0xc96f68, 0x8fb894, 0xd4a75e, 0x6b8790][index], -Math.PI / 2));
  const busShelter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.08), material(0x91a8a8, 0.35));
  busShelter.position.set(27, 0.9, -6.8);
  city.add(busShelter);
  const busFlag = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), material(0x26333b));
  busFlag.position.set(28.4, 0.9, -6.8);
  city.add(busFlag);

  const objectMeshes = new Map();

  // Create only the UK street objects permitted by the application state.
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
    } else if (object.type === "phonebox") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.05, 0.75), objectMaterial(0xc93632));
      box.position.y = 1.03;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.28, 4), objectMaterial(0xb52e2d));
      roof.position.y = 2.2;
      roof.rotation.y = Math.PI / 4;
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.9, 0.04), objectMaterial(0xb8d0ca, 0.25));
      window.position.set(0, 1.4, 0.39);
      group.add(box, roof, window);
    } else if (object.type === "litterbin") {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.75, 8), objectMaterial(0x4d5a5c));
      bin.position.y = 0.38;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 8), objectMaterial(0x26333b));
      lid.position.y = 0.8;
      group.add(bin, lid);
    } else if (object.type === "tree") {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.35, 7), objectMaterial(0x654d43));
      trunk.position.y = 0.68;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), objectMaterial(0x3c7d69));
      crown.position.y = 1.55;
      group.add(trunk, crown);
    } else if (object.type === "bush") {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), objectMaterial(0x3e705b));
      bush.scale.set(1.25, 0.7, 0.8);
      bush.position.y = 0.48;
      group.add(bush);
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
