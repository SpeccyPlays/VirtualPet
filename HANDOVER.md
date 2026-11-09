# Session handover

## Fresh-interest fallback — 9 November 2026

- Invalid research interest suggestions now trigger up to two local Ollama fresh-topic attempts, with randomized broad prompt directions and blocked/recent-topic validation. Valid replacements preserve their target. Exhaustion leaves interests unchanged with a visible explanation. All 46 tests passed; actual model topic diversity remains a runtime check.
- Also removed an erroneous no-sources prompt prefix referencing an undefined variable in the unrelated world-decision function, introduced in the earlier no-sources change. No private environment contents were read.

## Failed-search handling — 9 November 2026

- Failed self-research summaries now include the next allowed search time and survive ordinary status polling. If no future deadline is known, the UI explicitly says it needs server confirmation.
- A no-sources result now attempts a local Ollama alternative-interest decision before finishing the cooldown. Valid alternatives replace the failed interest; invalid/unavailable decisions leave interests unchanged with an explanation. No fabricated findings or failed-session narration are recorded.
- Full suite: 43 tests passed with mocked web/Ollama responses. Tests cover no-source replacement, retained cooldown, error summary changes/time and polling persistence. Private environment contents were not read.

## Latest behaviour — 9 November 2026

- Research no longer has a fixed five-minute floor: positive `SELF_RESEARCH_INTERVAL_MS` is the server default, and the browser can select Server setting (.env) or an explicit 2/5/10/15/30-minute override. Existing cooldown deadlines survive configuration changes.
- Narration is now session-only, unchecked on load; old saved preferences are ignored. Both enabling the checkbox and Enable sound speak the test phrase.
- Self-research reports researching during web search and thinking during Ollama work using server phase polling. Its completed topic/actual interest changes/next-time summary remains visible across routine schedule checks until the next research request. Not persisted on reload.
- Latest full suite: 41 tests passed, including phase transitions and persistent completed summaries. No private environment file was inspected. These notes supersede earlier fixed-minimum and persisted-narration descriptions below.

## Documentation checkpoint — 9 November 2026

- Owner confirmed speech works. README now documents first-install prerequisites, isolated Piper installation, voice/licence downloads, combined startup/shutdown, sound test and dependency/voice credits. DEVELOPMENT covers configuration, explicit triggers, audio activation, cancellation, diagnostics, fence recovery and verification limits. PIPER_SETUP wording now reflects integration and 39 passing tests.
- Ambient town sounds/crossfades are deferred to a future session; no ambient code was added. This documentation update changed no application code and did not read private environment settings. Local documentation links and diff whitespace were checked; tests were not rerun for documentation-only edits.

## Narration activation fix — 9 November 2026

- Enable sound previously did nothing when the separate narration checkbox was unchecked. It now enables/persists the preference, awaits browser audio activation and narrates a test phrase. Eligible thoughts received before activation display an explicit prompt instead of silently disappearing.
- Speech failures now expose the backend error in the frontend status. Node logs speech acceptance/completion/failure without thought text. The self-research successful-result path was confirmed to invoke narration.
- Browser check on localhost:3000: clicking Enable sound with narration off checked the toggle, submitted speech and completed Web Audio playback (status returned to Narration is on). Physical speaker output was not independently heard.

## Combined startup — 9 November 2026

- `npm start` now runs `start.js`, loading environment settings privately at runtime, validating local Piper configuration, launching or reusing Piper, checking real synthesis with the selected speaker, and starting Node. `npm run start:server` retains Node-only operation. Ctrl+C stops owned processes; reused Piper is left running.
- All 38 tests passed. A smoke test using public example settings reused local Piper, verified Semaine speaker 3 and started Node on test port 3011; the test launcher was then stopped. The private environment file was not inspected. Self-research's successful-result path already calls narration; browser sound activation is still required.

## Fence navigation recovery — 9 November 2026

- Reproduced diagonal fence-corner clipping between sampled navigation checks. Once an actor entered the obstacle clearance margin, all replans rejected its blocked starting point, causing repeated recovery captions without movement.
- Navigation now checks continuous rectangle intersections using the layout's shared 0.45-metre clearance. Actors already overlapping only a safety margin may move outward; entering the solid obstacle or moving deeper remains forbidden.
- Added a regression that exercises real route following from a blocked margin through to arrival, plus the corner-clipping case. All 36 tests passed using public example configuration; the owner's exact in-browser location and a long session remain unverified.

## Local speech preparation — 9 November 2026

- Narration integration is now implemented: `/api/speech` forwards text and configured speaker to Piper; the browser provides an opt-in saved toggle and explicit audio activation after reload. Only successful research and first non-ship location discoveries narrate. Disable cancels playback/requests and clears the bounded queue.
- Validation: 35 tests passed and real backend-to-Piper synthesis returned HTTP 200 WAV audio. Editor diagnostics were clear. Tests used public example configuration; private `.env` was not inspected. Browser listening and concurrent Ollama load remain manual checks. Earlier step-1 notes below describe setup history, not current integration status.

- Completed narration setup step 1 only: isolated `.venv-piper`, Piper 1.8.0 HTTP dependencies, and Semaine medium voice with model card/licence copies in ignored `data/piper`.
- CPU synthesis and all four speaker IDs were checked through the local HTTP server. The owner selected speaker 3 as Juniper's voice; the documented start command uses `--speaker 3`. No agent listening or concurrent Ollama performance check was performed.
- See [PIPER_SETUP.md](./PIPER_SETUP.md) for the start command, verification, licence sources and remaining shared-environment MediaPipe conflicts. No application code or narration integration was changed.
- Agreed narration scope: successful manual/autonomous research and first location discoveries only; exclude objects, random events, repeated visits and restored history. Frontend toggle should default off and stop/clear narration when disabled.

Updated: 7 November 2026. Read [README.md](./README.md), then [DEVELOPMENT.md](./DEVELOPMENT.md), before editing code.

## Completed changes

- Replaced cube-only scenery with seeded plots, varied building shapes, roofs, terrain, landmarks and locally generated materials. Split layout, navigation, rendering and population responsibilities into modules.
- Redesigned Juniper and her companion with radial alien anatomy, animation and a blinking face. Added a safe **Return to start** rescue button.
- Added pedestrians, traffic and wildlife; improved smooth turns, swept vehicle collision checks, crossing behaviour, temporary detours and recovery from persistently blocked routes. Invalid manual destinations preserve an existing route.
- Made the follow camera orbitable while retaining Juniper as its focus. Preferred zoom distance is independent of temporary camera obstruction shortening. Added a thinking/observation bubble and thought timestamps that age correctly.
- Routed event reactions through local Ollama, with bounded inference queuing and waiting-event priority. Enforced a persistent shared research cooldown of at least five minutes after completion. Fixed restored self-search selection/status/scheduling on refresh.
- Added a ship outside the High Street and stationed the companion beside it. Juniper returns every 360 simulation seconds, rests for 20 seconds and retries a failed approach after 30 seconds. Manual directions take priority.
- Juniper now starts beside the ship on load, with the camera centred there; the rescue button shares that home position. New ship thoughts/memories say "I have returned to my ship." Existing saved thoughts remain unchanged.
- Pinned Three.js locally, restricted public server files and added automated coverage. Browser memories and world seed are preserved across generator updates.

## Decisions to preserve

- Keep Three.js and plain JavaScript for now; no framework migration was implemented. Explain Three.js changes and include useful comments for the owner, who is a junior developer using JavaScript daily.
- Layout data is the shared source for geometry and collisions. Keep landmark IDs stable and preserve saved seeds/memories.
- Ship visits do **not** transfer information or memories to the companion. The optional `onShipVisit` callback in [world.js](./world.js) is reserved for that future feature; the app currently installs no handler.
- AI output is validated data, never executable JavaScript. Object creation currently uses supported object types; unrestricted creation from scratch was discussed, not implemented.
- Event reactions remain local; web research requires internet. Research cooldown has no override and is not reset by clearing browser memories.

## Known limitations and follow-up checks

- No new runtime defect was confirmed during this documentation pass. Earlier traffic jams and stuck routes received fixes, but long-running behaviour still warrants observation around fences, bins, crossings and stopped buses.
- Search currently reads DuckDuckGo HTML result snippets and links, not full articles. Scraping can break or be rate limited; source reliability and full-page evidence checking remain future work.
- The region is finite and its street structure constrained. Traffic uses a High Street loop rather than a complete lane/junction network. Navigation is a two-metre grid with dynamic detours, not a full crowd simulation.
- Ship timers and actor positions restart on reload. Automatic ship thought recording uses the existing first-discovery guard; recurring arrival thoughts would require separate handling. Old discovery wording remains in saved history.
- Automated tests mock external AI/search responses. They do not establish real Ollama response quality, live search reliability, visual quality or stability over a 45-minute session.
- The working tree contains substantial modified and untracked project files. No commit was made by this handover task. Review and commit a stable checkpoint separately. The owner previously deleted AGENTS.md; do not restore it from an older version without a request.

## Verification

- Re-ran `npm test` on 7 November 2026 after the spawn and ship-wording changes: **31 passed, 0 failed**.
- Coverage includes deterministic layouts, landmark reachability, ship clearing, save migration, research cooldown/queue/API behaviour, movement and vehicle checks, blocked-route recovery, scene construction, self-search restoration and thought ages.
- Editor diagnostics reported no errors in [world.js](./world.js) after the spawn change or [app.js](./app.js) after the wording change.
- This documentation pass did not run new browser or real Ollama checks and changed no application code.

## Suggested next steps

1. Refresh and visually check the ship spawn, initial camera, rescue button and new ship wording. Existing saves may already mark the ship discovered, so automatic first-discovery wording will not repeat.
2. Observe a longer session, including multiple ship visits, manual interruptions, crossings and route recovery. Record reproducible locations/seeds for any remaining obstruction.
3. If improving research next, agree the desired search provider and source-fetching approach, then add readable-page extraction, source attribution and bounded caching/timeouts with mocked tests. Preserve the research cooldown and event priority.
4. Implement companion memory transfer only when requested, using the arrival callback with an explicit saved-data format and migration plan.

## Starting a new chat

Suggested opening: "Read README.md, DEVELOPMENT.md and HANDOVER.md before reading code. I use JavaScript daily but have limited Three.js experience; please keep changes clearly commented. Today's task is ..."

Run with `npm start` and open `http://localhost:3000`; run checks with `npm test`. Restart the server after backend changes; refresh for frontend changes. Keep private environment settings out of handover notes.
