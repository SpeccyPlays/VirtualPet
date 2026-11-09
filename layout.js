// Pure world data: no DOM or Three.js imports. Units are approximately metres.
// Changing decoration salts does not change roads or building footprints.
export const WORLD_BOUNDS = { minX: -108, maxX: 108, minZ: -108, maxZ: 108 };
export function randomAt(seed, x, z, salt = 0) {
  let n = Math.imul((x | 0) ^ (seed >>> 0), 374761393) + Math.imul((z | 0) ^ salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function contains(rect, x, z, margin = 0) {
  return Math.abs(x - rect.x) < rect.width / 2 + margin && Math.abs(z - rect.z) < rect.depth / 2 + margin;
}
export function overlaps(a, b, margin = 0) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + margin && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + margin;
}
export function createLayout(seed = 1) {
  const rand = (x, z, salt) => randomAt(seed, x, z, salt);
  const west = -40 - rand(0, 0, 3) * 3, east = 40 + rand(0, 0, 5) * 3;
  const north = -27 - rand(0, 0, 7) * 2, south = 27 + rand(0, 0, 9) * 2;
  const roads = [
    { x: 0, z: 0, width: 132, depth: 8, name: "High Street" },
    { x: 0, z: north, width: 132, depth: 6, name: "Station Road" },
    { x: 0, z: south, width: 132, depth: 6, name: "Market Road" },
    { x: west, z: 0, width: 6, depth: 64, name: "West Road" },
    { x: east, z: 0, width: 6, depth: 64, name: "East Road" },
  ];
  const landmarks = [
    { id: "ship", name: "Juniper's Ship", x: -20, z: 62, width: 12, depth: 15, description: "Juniper's landed exploration craft rests in a clearing beyond the town. Her companion stays here." },
    { id: "observatory", name: "Wychmere Observatory", x: 72, z: 72, width: 10, depth: 10, description: "A domed observatory on the hillside." },
    { id: "quarry", name: "Redstone Quarry", x: -78, z: -66, width: 15, depth: 12, description: "A terraced exposure of red stone and old quarry machinery." },
    { id: "old-station", name: "Old Moorfield Station", x: -72, z: 48, width: 13, depth: 7, description: "A rural station with a slate roof and an empty platform." },
    { id: "wetlands", name: "Southmere Wetlands", x: 70, z: -72, width: 20, depth: 18, description: "Shallow water, reeds and waterbirds surround a quiet observation bank." },
    { id: "castle", name: "Brackenford Castle Ruins", x: -72, z: 72, width: 14, depth: 12, description: "Broken stone walls and round towers shelter moss and birds." },
    { id: "market", name: "Larkspur Market", x: 72, z: -20, width: 16, depth: 14, description: "Canvas stalls gather around a village market square." },
    { id: "grove", name: "Moonlit Grove", x: -42, z: 78, width: 16, depth: 16, description: "Old trees surround a circle of weathered stones." },
    { id: "river-crossing", name: "River Crossing", x: 0, z: -78, width: 18, depth: 4, description: "A timber footbridge crosses a narrow river." },
  ];
  const water = [
    { x: 70, z: -72, width: 15, depth: 12, kind: "pond" },
    { x: 0, z: -83, width: 4, depth: 50, kind: "river" },
  ];
  const plots = [];
  const shopNames = ["Town Grocers", "Golden Kebab", "Planet Pizza", "Bookshop", "News & Snacks", "Bakery", "Pharmacy", "Juniper Cafe"];
  // A shared terrace rhythm keeps streets coherent. Seeded plot widths and
  // district heights provide variety without randomly scattering buildings.
  for (const side of [-1, 1]) {
    let x = -33;
    let index = 0;
    while (x < 31) {
      const width = 5 + rand(index, side, 11) * 2;
      if (x + width > 34) break; // reserve the pavement at the cross street
      const kind = side === 1 && index % 4 === 1 ? "civic" : "shop";
      plots.push({ id: `centre-${side}-${index}`, x: x + width / 2, z: side * 12, width, depth: 9, height: kind === "civic" ? 8.4 : 6.4 + rand(index, side, 13) * 1.2, rotation: side === 1 ? Math.PI : 0, kind, roof: index % 3 === 0 ? "hip" : "gable", label: kind === "civic" ? ["Library", "Civic Hall", "Museum"][index % 3] : shopNames[index % shopNames.length], tone: rand(index, side, 17) });
      x += width + 0.5;
      index++;
    }
  }
  // Housing grows along the outer roads; gardens stay behind the street frontage.
  for (const side of [-1, 1]) {
    for (let index = 0; index < 9; index++) {
      const x = -59 + index * 14;
      const width = 7 + rand(index, side, 23) * 2;
      const kind = index === 5 ? "flats" : index === 7 && side === -1 ? "warehouse" : index % 3 ? "house" : "cottage";
      plots.push({ id: `home-${side}-${index}`, x, z: side * (40 + rand(index, side, 29) * 2), width, depth: 8, height: kind === "flats" ? 9 : 5.4, rotation: side === 1 ? Math.PI : 0, kind, roof: kind === "warehouse" ? "flat" : index % 2 ? "gable" : "hip", label: "", tone: rand(index, side, 31) });
    }
  }
  // Small rural clusters use the same plot contract as the town.
  for (const [cx, cz] of [[-84, -28], [84, 30]]) {
    roads.push({ x: cx < 0 ? -73 : 73, z: cz, width: 30, depth: 5, name: "Village Lane" });
    for (const offset of [-6, 6]) plots.push({ id: `village-${cx}-${offset}`, x: cx + offset, z: cz + 9, width: 7, depth: 7, height: 3.2, rotation: Math.PI, kind: "cottage", roof: "hip", label: "", tone: rand(cx, offset, 37) });
  }
  const paths = landmarks.map((landmark) => ({ a: { x: landmark.x, z: landmark.z }, b: { x: Math.max(-60, Math.min(60, landmark.x)), z: landmark.z > 0 ? 32 : -32 }, width: 2 }));
  // Paths meet the road ends rather than ending in a building's back garden.
  for (const path of paths) {
    if (Math.abs(path.b.x) < 36) path.b.x = path.b.x < 0 ? -40 : 40;
  }
  function isWater(x, z) {
    if (Math.abs(z + 78) < 1.9 && Math.abs(x) < 9) return false; // bridge deck
    return water.some((area) => contains(area, x, z, 0.4));
  }
  function heightAt(x, z) {
    // Smooth hills fade out around settled land and landmark foundations.
    let blend = Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 54) / 22));
    for (const place of landmarks) blend *= Math.min(1, Math.max(0, (Math.hypot(x - place.x, z - place.z) - 10) / 9));
    for (const road of roads) {
      const dx = Math.max(0, Math.abs(x - road.x) - road.width / 2 - 2);
      const dz = Math.max(0, Math.abs(z - road.z) - road.depth / 2 - 2);
      blend *= Math.min(1, Math.hypot(dx, dz) / 7);
    }
    if (isWater(x, z)) return -0.35;
    return blend * (0.8 + 0.55 * Math.sin(x / 19 + seed % 7) + 0.45 * Math.cos(z / 23));
  }
  // Share garden boundaries with rendering so routes cannot cross visible fences.
  const fences = plots.filter((p) => ["house", "cottage"].includes(p.kind)).map((plot) => ({ id: `fence-${plot.id}`, x: plot.x, z: plot.z + (plot.z > 0 ? 6 : -6), width: plot.width + 1, depth: 0.22 }));
  const obstacles = [...plots.map((plot) => ({ ...plot })), ...fences];
  obstacles.push({ id: "bus-shelter", x: 20, z: 6, width: 4, depth: 1.7 });
  for (const x of [-54, -44, 46, 56]) obstacles.push({ id: `parked-${x}`, x, z: 25.8, width: 3.5, depth: 1.7 });
  // Landmark navigation approaches stop outside solid structures, not inside them.
  for (const place of landmarks.filter((p) => ["ship", "observatory", "old-station", "quarry", "castle", "market"].includes(p.id))) obstacles.push({ ...place });
  const isWalkable = (x, z, clearance = 0.45) => Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 106 && Math.abs(z) <= 106 && !isWater(x, z) && !obstacles.some((o) => contains(o, x, z, clearance));
  const canPlace = (x, z, objects = []) => isWalkable(x, z, 1.3) && !roads.some((r) => contains(r, x, z, 0.8)) && !landmarks.some((p) => contains(p, x, z, 1)) && !objects.some((o) => Math.hypot(o.x - x, o.z - z) < 2);
  return { seed, roads, plots, paths, landmarks, water, fences, obstacles, navigationClearance: 0.45, heightAt, isWater, isWalkable, canPlace, bounds: WORLD_BOUNDS };
}
