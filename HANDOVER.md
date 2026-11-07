# Session handover

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
