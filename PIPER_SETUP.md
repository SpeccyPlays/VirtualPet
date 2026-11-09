# Local speech setup

Updated 9 November 2026. Speech is connected to Juniper through `/api/speech`.

## Installed setup

- Python 3.11 in the isolated `.venv-piper` environment (ignored by Git).
- `piper-tts[http]` 1.8.0 with CPU ONNX Runtime. `pip check` passed.
- Semaine medium British English voice in `data/piper` (ignored by Git).
- Four speaker samples: `data/piper/speaker-0.wav` through `speaker-3.wav`.
- Speaker 3 was selected by the owner as Juniper's voice on 9 November 2026. The integrated backend uses speaker ID `3`.

The public [environment example](./.env.example) records `PIPER_URL` and `PIPER_SPEAKER_ID=3`. The backend reads these settings and explicitly sends the selected speaker on each speech request. The owner has copied them into the private `.env`, which was not inspected during implementation. The direct Piper command below still needs `--speaker 3` for its own test interface: Piper does not automatically read the Node application's environment file.

The earlier user-level Piper installation was not removed. Its reported NumPy/protobuf conflicts with MediaPipe remain unresolved in that shared environment. This isolated environment does not use those shared packages. No PATH edit is needed.

## Start and stop

**Normal startup: run `npm start`.** [start.js](./start.js) loads private environment settings at runtime, starts Piper if needed, checks the voice and synthesizes a silent WAV test with the selected speaker, then starts Node. Ctrl+C stops processes it launched. An existing compatible Piper service is reused and left running. Stop an older Node server first. Use `npm run start:server` for Node alone.

The launcher uses `PIPER_URL` and `PIPER_SPEAKER_ID`. Optional `PIPER_MODEL`, `PIPER_DATA_DIR` and `PIPER_PYTHON` override the installed defaults; the existing setup needs no additional private settings. Automatic launch accepts local HTTP Piper addresses only. Requests explicitly select the configured speaker even when a reused service has another default. Missing installations or incorrect voices stop startup with an error.

The command below is now only needed to start Piper separately:

From the project folder in PowerShell:

```powershell
& ./.venv-piper/Scripts/python.exe -m piper.http_server -m en_GB-semaine-medium --data-dir data/piper --host 127.0.0.1 --port 5000 --speaker 3
```

Keep that terminal running; Ctrl+C stops it. No `--cuda` option is used, so synthesis runs on the CPU. Downloaded files allow local synthesis without internet. The HTTP server is bound to this computer only. It is Piper's development server for local evaluation.

Open <http://127.0.0.1:5000> to try the voice. Settings allow choosing the speaker. Alternatively, open the four WAV samples locally. Do not start a second instance if port 5000 is already occupied by this server.

The missing optional `onnx` alignment-package warning does not prevent speech generation; word/phoneme alignment is not needed for the proposed narration. No extra alignment dependency was installed.

## Verification

All four speaker IDs (0–3) returned WAV audio from `/synthesize`. The same 19-word sample took approximately 0.34–0.40 seconds per request in this initial local check, producing roughly 4.7–6.0 seconds of audio. These are spot measurements, not a benchmark under concurrent Ollama or rendering load. Audio was generated and its WAV header checked; listening quality remains for the owner to judge.

## Sources and licence information

- [Piper engine](https://github.com/OHF-Voice/piper1-gpl): GPL-3.0.
- [Semaine model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/semaine/medium/MODEL_CARD): lists four speakers, 22,050 Hz and the DFKI Semaine dataset under CC BY-NC-SA 4.0; notes fine-tuning from Lessac medium.
- [Dataset source](https://github.com/marytts/dfki-semaine-data).
- [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Copies of the model card and licence text are retained beside the voice. The card describes the dataset licence rather than a separate explicit model grant. Preserve its credits and licence notices when sharing relevant material. This setup is for the owner's noncommercial hobby use.

## Using narration

Run `npm start` and refresh the page. In Private thoughts, click **Enable sound** to enable narration and hear a short test phrase. It starts off on every page load and is not saved. Enable it again when wanted. Only successful manual/autonomous research thoughts and first location discoveries are spoken. Objects, random events, ship returns, repeated visits and restored history stay silent. Previously discovered places will not narrate again.

Turning the toggle off immediately stops playback, clears pending narration and aborts the browser request. Piper may finish computation already underway. The browser queues at most two waiting thoughts and expires them after one minute. Backend requests have a 15-second deadline, a 1,200-character limit and one active request; speech is independent of Ollama. If speech fails, text remains available and the status explains how to retry. Narration does not use web search or generate extra Ollama requests. Ambient audio remains unimplemented.

Latest integration verification: 39 automated tests passed, including discovery deduplication, queue limits, cancellation and Piper failures. A real request through `/api/speech` returned HTTP 200 with WAV audio from local Piper using public example configuration. Subsequent browser activation checks completed playback, and the owner confirmed audible speech. Performance under concurrent Ollama load still needs observation.
