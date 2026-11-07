# Juniper

Juniper is a browser-based Three.js simulation of an alien exploring the fictional UK town of Wychmere. She observes local life, develops interests, remembers landmarks, and researches the web through a locally running Ollama model.

This project was coded collaboratively with assistance from OpenAI Codex.

## Run it

Requires Node.js 20 or newer and Ollama for generated thoughts.

```powershell
npm install
npm start
```

Open `http://localhost:3000`. Copy `.env.example` to `.env` to configure the model, Ollama URL, timeout, or port. Choose an installed model in the page. Rendering works without Ollama; event facts remain visible if reactions cannot be generated. Web research still requires internet access. Three.js and generated textures are served locally; optional Google Fonts fall back to system fonts offline.

## The world

- Seeded street-facing plots, terraced shops, civic buildings with side wings, houses, cottages, flats and a warehouse.
- Gabled, hipped and flat roofs; brick textures, chimneys, windows, shopfronts, gardens, pavements, road markings and a bus shelter.
- Continuous countryside terrain, a pond and river, a bridge, trees, market stalls, an observatory, a station, ruins, quarry and grove.
- Juniper has a radial alien body with three supporting limbs, a translucent sensory mantle and animated luminous organs. Her companion shares that biology.
- Route planning avoids building footprints, water and interactive objects. Click ground to guide Juniper; click objects or landmarks to inspect them. Landmark travel now actually sets a walking route.
- Pedestrians, left-hand High Street traffic, a stopping bus, roaming foxes, cats and pigeons. Traffic yields to nearby pedestrians. This is a lightweight town simulation, not a complete traffic engine.
- Time, weather, visible rain and local observations. Juniper reacts to things within observation range rather than knowing about every distant animal.
- Tracking and collision-aware first-person cameras, population controls and graphics settings.
- Smooth character turns and follow-camera heading; Juniper waits for traffic and can reroute around stopped vehicles.
- Cars yield to people in their actual path rather than everyone on a crossing. Pedestrians and Juniper retry blocked routes; persistent obstructions lead Juniper to choose another destination.
- A blinking alien face and a **Return to start** rescue button that preserves memories and chooses nearby clear ground if the spawn is busy. This is separate from the full save Reset control.
- Juniper's ship rests in a clearing beyond the housing, with her companion stationed beside it. Juniper starts beside the ship whenever the world loads; **Return to start** also brings her back there. Juniper returns every six minutes of simulation time and rests for twenty seconds before exploring again. Manual directions override these visits; clicking the ship also allows travel there. Visits do not transfer memories or information.
- Drag to orbit around Juniper while tracking her. Zoom remembers your chosen distance even when a wall temporarily pushes the camera closer.
- A floating thought bubble indicates local-model work or observation. New thoughts store timestamps and their displayed ages update automatically; legacy thoughts without dates are shown as "Earlier".

The finite region is 216 metres across. Layout generation follows a constrained town structure; seeds vary plots, side-street spacing, architecture and vegetation. It does not yet generate arbitrary street topologies or stream an infinite world.

## Local AI and research

Event facts are sent to `/api/event-reaction`, which uses local Ollama without web search. Reactions include current interests and recent memories. One local inference runs at a time, with waiting event reactions prioritised over ordinary inference. An active inference finishes before another starts. Old queued observations expire, and the browser retains only the newest waiting event.

Manual and autonomous research share a server-enforced pause of **at least five minutes after a session finishes**, including failed sessions. Options are 5, 10, 15 and 30 minutes. A session can include several model calls; event reactions remain available during the pause. There is no cooldown override. The selected duration applies to the next research session.

The schedule is stored in ignored `data/research-schedule.json`, so refreshes, other tabs and server restarts cannot bypass it. Resetting browser memories does not reset this server schedule. `SELF_RESEARCH_INTERVAL_MS` cannot lower the five-minute minimum.

Research uses DuckDuckGo result snippets and source links; it does not fetch and verify entire articles. HTML scraping may fail when the provider changes its pages or limits requests.

## Saves and local access

Interests, thoughts, objects, discoveries, events and the world seed are stored in browser `localStorage`. Generator updates preserve the seed and memories. Objects that overlap the new layout are moved to nearby clear ground and their coordinates saved. A malformed JSON save is copied to `juniper-state-recovery` before defaults are restored. Browser storage can still be cleared by the browser; export important memories manually before clearing site data.

The server binds to `127.0.0.1` by default and serves an explicit allowlist of frontend files. Keep `.env` private. Setting `HOST` to a LAN address exposes an unauthenticated local application and should be a deliberate development decision.

## Development

```powershell
npm test
```

Tests cover layout determinism and overlaps, routes to landmarks, saved-state migration, persistent cooldowns, AI queue priority, local HTTP endpoints and procedural scene construction. External search and model responses are mocked in API tests.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for Three.js explanations and tuning points. Add `?debug=1` to the page URL to expose `juniperDebug.metrics()` in the browser console for draw calls, triangles and GPU resource counts. Compare the same seed, camera and graphics settings when profiling.

## Project structure

- [layout.js](./layout.js): deterministic world data, terrain height and spatial validation.
- [navigation.js](./navigation.js): A* routes and obstacle checks, independent of rendering.
- [city.js](./city.js): architecture, terrain, landmarks, textures and static batching.
- [pet.js](./pet.js): alien geometry and named animation controls.
- [population.js](./population.js): pedestrians, traffic, wildlife and street furniture.
- [movement.js](./movement.js): smooth heading updates and vehicle collision checks.
- [world.js](./world.js): camera, frame updates, navigation integration and observations.
- [app.js](./app.js): UI, interests, event reactions and research coordination.
- [save-state.js](./save-state.js): validated save restoration.
- [research-policy.js](./research-policy.js): shared research interval rules.
- [research-gate.js](./research-gate.js): persistent server research lock and schedule.
- [ai-queue.js](./ai-queue.js): bounded inference queue.
- [server.js](./server.js): HTTP routes, Ollama transport and web search.
