import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as THREE from "three";
import { createNavigation } from "../navigation.js";
import { contains } from "../layout.js";
import { turnTowards } from "../movement.js";

function layoutWith(obstacles) {
  return { obstacles, roads: [], isWalkable(x, z) { return Math.abs(x) <= 104 && Math.abs(z) <= 104 && !this.obstacles.some((o) => contains(o, x, z, 0.1)); } };
}
test("routes connect from visible grid anchors beside fences and bins", () => {
  for (const depth of [12, 0.8]) {
    const layout = layoutWith([{ x: 0.6, z: 0, width: 0.1, depth }]), nav = createNavigation(layout);
    const start = { x: 0.85, z: 0 };
    assert.equal(nav.segmentClear(start, nav.nearest(start)), false, "Reproduce the old closest-anchor failure");
    const path = nav.route(start, { x: 6, z: 0 });
    assert.ok(path.length);
    assert.ok(nav.segmentClear(start, path[0]));
    for (let i = 1; i < path.length; i++) assert.ok(nav.segmentClear(path[i - 1], path[i]));
  }
});
test("temporary detours restore obstacles and removed objects free grid nodes", () => {
  const layout = layoutWith([{ x: 0, z: 0, width: 0.5, depth: 0.5 }]), nav = createNavigation(layout);
  layout.obstacles.length = 0;
  assert.deepEqual(nav.nearest({ x: 0, z: 0 }), { x: 0, z: 0 });
  const path = nav.routeAround({ x: -4, z: 0 }, { x: 4, z: 0 }, [{ x: 0, z: 0, width: 2, depth: 2 }]);
  assert.ok(path.length);
  assert.equal(layout.obstacles.length, 0);
});
const source = readFileSync(new URL("../world.js", import.meta.url), "utf8");
test("Juniper abandons a permanently blocked goal instead of waiting forever", () => {
  const code = source.slice(source.indexOf("  function followRoute("), source.indexOf("  // One update per frame"));
  const actor = { position: new THREE.Vector3(), rotation: { y: 0 }, userData: {} }, path = [{ x: 2, z: 0 }];
  const context = vm.createContext({ actor, path, turnTowards, navigation: { segmentClear: () => true, routeAround: () => [] }, population: { walkerBlocked: () => true, trafficObstacles: () => [], crowdObstacles: () => [] } });
  vm.runInContext(code, context);
  vm.runInContext("for(let i=0;i<210;i++) followRoute(actor,path,0.05,1.1)", context);
  assert.equal(path.length, 0); assert.equal(actor.userData.routeFailed, true);
  assert.equal(actor.position.x, 0, "Recovery must not walk through the obstruction");
});
test("an unreachable click preserves Juniper's existing working route", () => {
  const code = source.slice(source.indexOf("  const walkTo ="), source.indexOf("  const raycaster ="));
  const route = [{ x: 2, z: 0 }];
  const context = vm.createContext({ route, juniper: { position: { x: 0, z: 0 } }, navigation: { route: () => [] }, onCaption() {} });
  vm.runInContext(code, context);
  assert.equal(vm.runInContext("walkTo({x:99,z:99},true)", context), false);
  assert.equal(context.route, route); assert.equal(route.length, 1);
});
