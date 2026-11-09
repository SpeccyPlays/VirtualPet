# Juniper

Juniper is a browser-based Three.js simulation of an alien exploring the fictional UK town of Wychmere. She observes local life, develops interests, remembers landmarks, and researches the web through a locally running Ollama model.

This project was coded collaboratively with assistance from OpenAI Codex.

## Prerequisites and first-time setup

The tested setup is Windows with Python 3.11, Piper 1.8.0 and Node.js 22. The application requires Node.js 20 or newer.

- Install [Node.js](https://nodejs.org/) with npm and use a modern browser with WebGL and Web Audio support.
- Install [Python 3.11](https://www.python.org/downloads/) with the Windows Python launcher (`py`) for local speech. No CUDA toolkit or GPU setup is needed for Piper.
- Install [Ollama](https://ollama.com/download) and download a text model for generated thoughts and research summaries. Model licences and hardware needs vary. Start Ollama before using generated thoughts.
- Internet is needed for initial downloads and web research. Installed speech models and local thought generation can run offline; optional Google Fonts fall back to system fonts.

From the project folder in PowerShell, install the JavaScript dependencies and an isolated speech environment:

```powershell
npm install
py -3.11 -m venv .venv-piper
& ./.venv-piper/Scripts/python.exe -m pip install "piper-tts[http]==1.8.0"
& ./.venv-piper/Scripts/python.exe -m piper.download_voices en_GB-semaine-medium --download-dir data/piper
& ./.venv-piper/Scripts/python.exe -m pip check
```

Keep Piper isolated: installing it into a shared Python environment can conflict with packages such as MediaPipe. These commands need neither environment activation nor a PATH change. Downloaded environments and voices are ignored by Git and must be installed on a fresh checkout.

Retain the voice's model card and licence beside the downloaded model:

```powershell
Invoke-WebRequest -Uri 'https://huggingface.co/rhasspy/piper-voices/raw/main/en/en_GB/semaine/medium/MODEL_CARD' -OutFile data/piper/MODEL_CARD
Invoke-WebRequest -Uri 'https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.txt' -OutFile data/piper/LICENSE.txt
```

On a new installation only, copy [.env.example](./.env.example) to a private `.env`. If you already have private settings, add missing entries manually instead of overwriting the file. Set `OLLAMA_MODEL` to an installed model. The speech defaults are `PIPER_URL=http://127.0.0.1:5000` and `PIPER_SPEAKER_ID=3`. See the licensing notices below before sharing voice assets.

## Run it

```powershell
npm start
```

Open <http://localhost:3000>. The launcher loads environment settings at runtime, starts or reuses local Piper, verifies Semaine and generates a WAV test using the configured speaker, then starts Node. The startup test is not played aloud. Keep the terminal open; Ctrl+C stops the processes the launcher started. A reused Piper instance is left running. Stop any older Node server before starting another.

Click **Enable sound** under Private thoughts: it turns narration on for this page session and speaks a short confirmation. Narration starts off after every reload; turn it on again when wanted. The narration checkbox can stop speech immediately. Only successful manual/autonomous research thoughts and first non-ship location discoveries speak; objects, random events, repeat visits and restored history stay silent. Previously discovered places do not narrate again.

The status below the controls shows failures; Node logs `[speech]` requests without thought text. See [PIPER_SETUP.md](./PIPER_SETUP.md) for manual startup and troubleshooting. Ambient town sounds and area crossfades are planned for a later session, not implemented.

To run without installing or starting Piper, use `npm run start:server`; rendering and text still work, while narration requires a separately running speech service. Text continues working if speech becomes unavailable after startup. The combined launcher deliberately stops if its speech check fails.

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

Manual and autonomous research share a server-enforced pause **after a session finishes**, including failed sessions. Select **Server setting (.env)** to use `SELF_RESEARCH_INTERVAL_MS`, or override it in the browser with 2, 5, 10, 15 or 30 minutes. There is no hard-coded five-minute floor; invalid or missing server values default to five minutes. A session can include several model calls; event reactions remain available during the pause. There is no cooldown override. The selected duration applies to the next research session.

The schedule is stored in ignored `data/research-schedule.json`, so refreshes, other tabs and server restarts cannot bypass it. Resetting browser memories does not reset this server schedule. Configuration changes apply to subsequent sessions; a persisted cooldown already in progress retains its deadline.

Research uses DuckDuckGo result snippets and source links; it does not fetch and verify entire articles. HTML scraping may fail when the provider changes its pages or limits requests.

## Saves and local access

Interests, thoughts, objects, discoveries, events and the world seed are stored in browser `localStorage`. Generator updates preserve the seed and memories. Objects that overlap the new layout are moved to nearby clear ground and their coordinates saved. A malformed JSON save is copied to `juniper-state-recovery` before defaults are restored. Browser storage can still be cleared by the browser; export important memories manually before clearing site data.

The server binds to `127.0.0.1` by default and serves an explicit allowlist of frontend files. Keep `.env` private. Setting `HOST` to a LAN address exposes an unauthenticated local application and should be a deliberate development decision.

## Development

Optional offline narration uses Piper with Semaine medium, speaker 3. See [PIPER_SETUP.md](./PIPER_SETUP.md) to start the CPU speech service. Enable **Narrate Juniper's thoughts** in Private thoughts; after reloading, click **Enable sound**. It speaks successful research thoughts and first location discoveries only. The preference defaults off; disabling it stops speech and clears queued narration. Text continues working if Piper is unavailable.

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
- [start.js](./start.js): combined Piper/Node startup, voice checks and child-process shutdown.
- [speech.js](./speech.js): bounded, validated local Piper speech requests.
- [narration.js](./narration.js): browser audio activation, playback, queue and cancellation.

## Third-party credits and licensing notices

These notices describe dependencies and voice assets; they do not assign a new licence to Juniper's own source code.

| Component | Credit and licence |
|---|---|
| Three.js | Three.js authors; MIT. Preserve its copyright and licence notice when redistributing. See the installed `node_modules/three/LICENSE`. |
| Express | Express contributors; MIT. See the installed `node_modules/express/LICENSE`. |
| dotenv | Scott Motte; BSD-2-Clause in the installed version. See `node_modules/dotenv/LICENSE`. |
| Piper 1.8.0 | [Open Home Foundation / Piper contributors](https://github.com/OHF-Voice/piper1-gpl); GPL-3.0. Piper runs as a separate local process. Preserve its licence and satisfy applicable source-distribution requirements if redistributing Piper. |
| Semaine medium voice | [rhasspy Piper voice model](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/semaine/medium/MODEL_CARD), trained using the [DFKI SEMAINE speech databases published through MaryTTS](https://github.com/marytts/dfki-semaine-data). The model card lists the dataset under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) and notes fine-tuning from Lessac medium. Juniper uses the downloaded model without fine-tuning, selecting speaker 3. |

For CC BY-NC-SA licensed material, retain attribution and licence links, identify changes, use it noncommercially and distribute shared adaptations under the same licence. The voice card labels the **dataset** licence rather than a separate explicit model grant; this notice does not assume every generated audio clip or all application code automatically inherits that licence. Preserve upstream notices and clarify permissions before distributing voice assets or changing to commercial use. This voice is selected for a personal noncommercial hobby project; a noncommercial restriction is not an unrestricted open-source licence.

Local model-card and licence copies are stored in ignored `data/piper`, so a fresh checkout must download them using the setup commands above. Piper's Python dependencies, Ollama, each installed Ollama model and optional font files have their own licences; retain their supplied notices when redistributing those components. This section is not an exhaustive licence inventory for a packaged release.
