import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCity } from "../city.js";
import { createPet } from "../pet.js";

test("scene builds finite geometry, relocates old objects and keeps picking IDs after batching", () => {
  // CanvasTexture only needs a canvas-shaped object until WebGL uploads it.
  // Actual texture appearance is checked in the browser, not guessed by this test.
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }) }) };
  let city;
  try {
    const objects = [{ id: "legacy", type: "bench", x: -30, z: 12 }];
    city = createCity({ worldSeed: 42, objects });
    assert.ok(Math.hypot(objects[0].x + 30, objects[0].z - 12) > 1);
    assert.ok(city.objectMeshes.has("legacy"));
    assert.ok(city.landmarkMeshes.get("ship").getObjectByName("ship-hull"));
    assert.ok(city.layout.obstacles.some((o) => o.id === "object:legacy"));
    for (const [id, group] of city.landmarkMeshes) group.traverse((child) => assert.equal(child.userData.landmarkId, id));
    let meshes = 0;
    city.city.traverse((child) => {
      if (!child.geometry) return;
      meshes++;
      for (const value of child.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    });
    assert.ok(meshes < 650, `Static batching regressed: ${meshes} meshes`);
    city.removeObject("legacy"); assert.ok(!city.layout.obstacles.some((o) => o.id === "object:legacy"));
    assert.ok(!city.objectMeshes.has("legacy"));
    const pet = createPet(0x315f68, 0x91e7c1, 0xc4b4ff, new THREE.Vector3());
    const face = pet.getObjectByName("face");
    assert.ok(face); assert.ok(face.getObjectByName("mouth"));
    pet.userData.animate(0.09);
    assert.ok(face.getObjectByName("left-eye").scale.y < 0.1);
    pet.userData.animate(12, true, true);
    assert.ok(face.getObjectByName("left-eye").scale.y > 1);
    assert.equal(face.rotation.y, 0, "The face must not spin with the mantle");
    pet.traverse((child) => assert.ok(Number.isFinite(child.position.x)));
  } finally {
    globalThis.document = previous;
    city?.city.traverse((child) => child.geometry?.dispose());
  }
});
