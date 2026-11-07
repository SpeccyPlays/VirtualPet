# Editing Juniper

## Where to start

Read [README.md](./README.md) first, then this guide. For the latest session decisions, verification and unfinished work, read [HANDOVER.md](./HANDOVER.md). The project owner uses JavaScript daily but has little Three.js experience; explain geometry, camera and navigation changes with practical comments.

The important separation is **layout data → navigation/rendering → behaviour → UI**. Change town measurements in [layout.js](./layout.js), rather than hard-coding matching numbers into a building mesh and collision function separately. All positions use X/Z for the ground plane and Y for height. One unit is approximately one metre.

## Buildings and layout

[createLayout](./layout.js) produces roads, plots, landmarks and water. `randomAt(seed, x, z, salt)` returns a repeatable value between zero and one. Salts separate decisions: changing tree variation should not change shop widths. Keep IDs stable where possible, because discoveries refer to landmark IDs.

Plots reserve the entire footprint, including civic wings. `rotation` turns a building around Y; `0` faces positive Z, `Math.PI` faces negative Z. Update the spatial representation if you introduce arbitrary rotations: the current rectangular collision bounds assume axis-aligned footprints.

In [city.js](./city.js), `building()` constructs walls, roofs and facade details. `box()` takes parent, width, height, depth, colour, X, Y, Z; its coordinates are relative to the parent. A `THREE.Group` makes these pieces move and rotate together. The group is positioned on the plot only after its children have been assembled locally.

Gabled roofs extrude a triangular `Shape` along Z. Hipped roofs scale a four-sided cone. Flat warehouse roofs use a shallow box. To add an architectural family, first add its plot rules, then handle its `kind` in the renderer. Keep all geometry within the reserved footprint or extend the collision data too.

Textures are drawn onto small canvases locally. `CanvasTexture` uploads a canvas to the GPU. Colour textures use `SRGBColorSpace`; lighting calculations use linear colour internally. To improve material realism later, replace the generated maps with appropriately licensed brick/roof albedo, normal and roughness maps.

## Terrain and navigation

`heightAt(x, z)` is the common source of elevation. Buildings, walkers and rendered terrain use it. Roads and landmark foundations flatten the hills; water lowers the terrain beneath the water surface. Terrain rendering samples this function on a grid, so keep height changes smooth rather than adding sharp discontinuities.

[navigation.js](./navigation.js) uses A* over a two-metre grid. It checks intermediate points along every movement segment, preventing diagonal movement through building corners. A blocked target is redirected to a nearby walkable cell. A smaller grid improves access through narrow gaps but increases planning work.

The graph favours road edges over lawns and road centres. It does not yet restrict every crossing to a zebra crossing or implement a full pedestrian right-of-way system. Routes connect through several visible nearby grid nodes, so the nearest node being across a fence is not a dead end. Walkability is checked dynamically, including after object removal. `routeAround()` temporarily adds traffic/crowd footprints and restores the original obstacle list afterwards. Juniper retries after short waits and releases a goal after ten seconds of continuous blockage; pedestrians also replan rather than waiting indefinitely. An unreachable click preserves an existing route. Collision buffers allow outward escape while still forbidding passage through cars.

## Juniper and the population

Edit the mantle profile and limb arrangement in [pet.js](./pet.js). `LatheGeometry` revolves a 2D profile around Y. Each limb has its own pivot group, allowing animation without rebuilding geometry. `character.userData.animate(elapsed, walking, alert)` controls gait, breathing and sensory movement.

The ship is the `ship` landmark in [layout.js](./layout.js), rendered in [city.js](./city.js). Its collision footprint includes the access ramp; terrain flattening and tree exclusion keep the clearing usable. The companion stays at the ship's side instead of using Juniper's exploration destinations. `createShipVisitSchedule()` in [movement.js](./movement.js) sets the return interval, rest duration and failed-route retry delay in seconds. The visit timer restarts with a page reload, like the rest of the world simulation. [world.js](./world.js) exposes an optional `onShipVisit` arrival callback as a future extension point. No callback is installed by the app, and no memory transfer or companion knowledge store is implemented.

Juniper starts at the ship approach point whenever the world loads. In [world.js](./world.js), `startingPosition` clones `shipApproach` and sets its terrain height; the initial camera overview moves with it. The **Return to start** button uses this same home position, choosing nearby safe ground if occupied. Changing the ship coordinates therefore also changes her starting area without another set of hard-coded coordinates.

In [app.js](./app.js), automatic first-visit recording and manual landmark memories treat `ship` as familiar: the thought is "I have returned to my ship." Other landmarks retain discovery wording. Automatic recording still uses the existing first-discovery guard, so it does not add a new thought on every ship return. Existing saved thoughts are not rewritten.

[population.js](./population.js) collects population sizes and speeds at the top. Background people and animals use simulation routes rather than model calls. Traffic runs on a bounded High Street loop with left-hand lanes, headway checks, pedestrian yielding and a bus pause. Expanding traffic to every road requires a lane/junction graph; do not simply point cars at arbitrary pedestrian destinations.

[movement.js](./movement.js) holds heading and vehicle collision calculations. `turnTowards()` limits character rotation to radians per second and follows the shortest angle across the +/- PI boundary. Tracking keeps a user-controlled orbit direction and preferred zoom distance separate from wall-collision adjustments. Dragging changes direction; wheel/buttons change only the preferred distance. Vehicle footprints include the bus length and wheel width, expanded by the walker's clearance. Walking checks the entire proposed step; traffic checks intermediate poses before moving. After waiting for a stopped vehicle, Juniper temporarily includes vehicle footprints in route planning to find a detour.

## Events and inference

[world.js](./world.js) emits observable **facts** from nearby actors or weather. [app.js](./app.js) records each event and sends its ID, facts, interests and recent memories to the local reaction endpoint. The generated reaction is stored separately from the facts. Failed or expired responses do not become invented fallback reactions.

[ai-queue.js](./ai-queue.js) serialises inference. A higher priority moves a waiting event ahead of waiting research calls; it cannot interrupt an inference already executing. Bound the queue and expire stale events before increasing event frequency. The browser coalesces waiting observations to avoid a growing backlog.

All model output is untrusted data. Validate types, lengths, permitted actions and spatial placement before applying changes. World additions are checked on both the server and browser. The model never generates executable JavaScript.

## Research and saves

[research-policy.js](./research-policy.js) defines the five-minute minimum. [research-gate.js](./research-gate.js) owns the authoritative server schedule and an in-flight lock. Both research endpoints enter that gate. Persisting before work begins protects the cooldown on crashes; finishing extends it from completion. The client reads the server schedule instead of deriving its own one-minute adjustment.

On refresh, [app.js](./app.js) restores the self-search selection and interval, then waits for both model discovery and the server schedule before starting research. Keep the toggle, status text and scheduler on the same state path; restoring only the checkbox previously left enabled self-search inactive until toggled again.

[save-state.js](./save-state.js) separates the generator version from the saved-data shape. Preserve seeds and memories in migrations. Invalid old object positions are relocated by the renderer during initialisation and saved by the app. Never bump a version merely to force users to lose their world.

Thoughts store `createdAt` in wall-clock milliseconds, not a frozen display string. `thoughtAge()` derives the visible age; the UI refreshes only the time elements every 15 seconds and when the tab becomes visible. Legacy thoughts have unknown dates and display "Earlier". `fetchThinking()` counts outstanding model operations so one completed request cannot hide the bubble while another is still pending; ordinary observations show it briefly through `showObservation()`.

## Rendering cost and disposal

A `Mesh` combines geometry with material. Many small meshes mean many draw calls even when their polygon counts are low. `batchStatic()` merges pieces sharing a material inside each building. Landmark/object groups retain their picking IDs. `InstancedMesh` renders the forest as two draws using per-tree transform matrices.

Detailed mode keeps facade detail visible farther away, enables shadows and caps pixel density at two. Performance mode lowers pixel density, disables shadows and hides distant small details. Removing an object disposes its geometry while preserving shared materials; disposing the whole world releases its geometry, textures, materials and renderer.

Use `http://localhost:3000/?debug=1`, then `juniperDebug.metrics()` in the browser console. Compare the same view before and after a change. The finite world is batched rather than streamed; introduce streaming only if a larger region justifies the complexity.

## Validation checklist

Run `npm test`, then inspect both an overview and a street-level view. Check multiple seeds, night/rain, both graphics settings, tracking, first-person entry from above a roof, landmark travel, adding/removing objects and model unavailability. API tests stub external services; a real Ollama check is still useful for prompt quality and latency. Never run automated web research against the live provider just to test cooldown logic.
