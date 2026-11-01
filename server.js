import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const ollamaUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(
  /\/$/,
  "",
);
const defaultModel = process.env.OLLAMA_MODEL || "llama3.2";
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const selfResearchIntervalMs = Number(
  process.env.SELF_RESEARCH_INTERVAL_MS || 60000,
);
const selfResearchRequests = new Map();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  const ollama = await ollamaRequest("/api/tags", { method: "GET" });
  res.json({ ok: true, ollama: ollama.ok, defaultModel });
});

app.get("/api/models", async (_req, res) => {
  const response = await ollamaRequest("/api/tags", { method: "GET" });
  if (!response.ok)
    return res
      .status(503)
      .json({ error: "Ollama is not reachable", detail: response.error });
  const models = (response.data.models || [])
    .map((model) => model.name)
    .filter(Boolean);
  res.json({ models, defaultModel });
});

app.post("/api/thought", async (req, res) => {
  const model = getModel(req.body?.model);
  const context =
    typeof req.body?.context === "string"
      ? req.body.context.trim().slice(0, 500)
      : "Juniper is spending a quiet moment in the Lantern District.";
  try {
    res.json({ model, thought: await askOllamaThought(context, model) });
  } catch (error) {
    res
      .status(error.status || 503)
      .json({
        error: error.publicMessage || "Thought generation failed.",
        detail: error.message,
      });
  }
});

app.post("/api/interest", async (req, res) => {
  const model = getModel(req.body?.model);
  const existing = Array.isArray(req.body?.interests)
    ? req.body.interests.filter((item) => typeof item === "string").slice(0, 10)
    : [];
  const thoughts = Array.isArray(req.body?.thoughts)
    ? req.body.thoughts.filter((item) => typeof item === "string").slice(0, 6)
    : [];
  const memory = getResearchMemory(req.body);
  try {
    res.json({
      model,
      ...(await askOllamaInterest(existing, thoughts, model, memory)),
    });
  } catch (error) {
    res
      .status(error.status || 503)
      .json({
        error: error.publicMessage || "Interest generation failed.",
        detail: error.message,
      });
  }
});

app.post("/api/research", async (req, res) => {
  const query =
    typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const model = getModel(req.body?.model);
  const memory = getResearchMemory(req.body);
  if (!query || query.length > 160)
    return res
      .status(400)
      .json({
        error: "Please provide a research question up to 160 characters.",
      });

  try {
    const sources = await searchWeb(query);
    if (!sources.length)
      return res
        .status(404)
        .json({ error: "No web sources were found for that interest." });
    const answer = await askOllama(query, sources, model, memory);
    res.json({ query, model, ...answer, sources });
  } catch (error) {
    res
      .status(error.status || 502)
      .json({
        error: error.publicMessage || "Research failed.",
        detail: error.message,
      });
  }
});

app.post("/api/self-research", async (req, res) => {
  const query =
    typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const model = getModel(req.body?.model);
  const interests = Array.isArray(req.body?.interests)
    ? req.body.interests.filter((item) => typeof item === "string").slice(0, 10)
    : [];
  const memory = getResearchMemory(req.body);
  const override = req.body?.override === true;
  const clientKey = req.ip || "local-user";
  const lastRequest = selfResearchRequests.get(clientKey) || 0;
  const elapsed = Date.now() - lastRequest;
  if (!override && elapsed < selfResearchIntervalMs) {
    const retryAfterMs = selfResearchIntervalMs - elapsed;
    return res
      .status(429)
      .json({
        error: "Juniper is giving the web a little breathing room.",
        retryAfterMs,
        nextAllowedAt: new Date(Date.now() + retryAfterMs).toISOString(),
      });
  }
  if (!query || query.length > 160)
    return res
      .status(400)
      .json({ error: "Please provide an interest up to 160 characters." });
  selfResearchRequests.set(clientKey, Date.now());
  try {
    const sources = await searchWeb(query);
    if (!sources.length)
      return res
        .status(404)
        .json({
          error: "Juniper could not find web sources for that interest.",
        });
    const answer = await askOllama(query, sources, model, memory);
    let interestUpdate = {
      action: "keep",
      interest: "",
      reason: "I am still curious about this, so I will keep it on my list.",
    };
    try {
      interestUpdate = await decideInterestUpdate(
        query,
        answer.summary,
        interests,
        model,
        memory,
      );
    } catch {
      /* Research remains useful if interest evolution is unavailable. */
    }
    res.json({
      query,
      model,
      ...answer,
      interestUpdate,
      sources,
      nextAllowedAt: new Date(
        Date.now() + selfResearchIntervalMs,
      ).toISOString(),
      intervalMs: selfResearchIntervalMs,
    });
  } catch (error) {
    res
      .status(error.status || 502)
      .json({
        error: error.publicMessage || "Juniper's research failed.",
        detail: error.message,
      });
  }
});

app.post("/api/world-decision", async (req, res) => {
  const model = getModel(req.body?.model);
  const interests = Array.isArray(req.body?.interests) ? req.body.interests.filter((item) => typeof item === "string").slice(0, 10) : [];
  const thoughts = Array.isArray(req.body?.thoughts) ? req.body.thoughts.filter((item) => typeof item === "string").slice(0, 6) : [];
  const objects = Array.isArray(req.body?.objects) ? req.body.objects.filter((item) => item && typeof item === "object").slice(0, 20) : [];
  try { res.json({ model, ...(await askOllamaWorldDecision(interests, thoughts, objects, model)) }); }
  catch (error) { res.status(error.status || 503).json({ error: error.publicMessage || "Juniper could not decide what to do with the city.", detail: error.message }); }
});

async function searchWeb(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "user-agent": "JuniperResearch/0.1 (+local app)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw Object.assign(new Error(`Search returned ${response.status}`), {
      status: 502,
      publicMessage: "The web search provider did not respond.",
    });
  const html = await response.text();
  const sources = [];
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(resultPattern)) {
    const link = decodeHtml(match[1]);
    const resolvedUrl = link.startsWith("//") ? `https:${link}` : link;
    if (!resolvedUrl.startsWith("http")) continue;
    sources.push({
      id: sources.length + 1,
      title: cleanText(match[2]),
      url: resolvedUrl,
      snippet: cleanText(match[3]),
    });
    if (sources.length === 6) break;
  }
  return sources;
}

async function askOllama(query, sources, model, memory) {
  const sourceText = sources
    .map(
      (source) =>
        `[${source.id}] ${source.title}\nURL: ${source.url}\n${source.snippet}`,
    )
    .join("\n\n");
  const prompt = `You are Juniper, a curious virtual pet. Research the user's interest using only the sources below. Be warm, concise, and honest about uncertainty. Return ONLY valid JSON with this shape: {"summary":"2-3 sentence summary","thought":"one first-person thought Juniper would have","sourceIds":[1,2]}. sourceIds must contain only source numbers that support the summary.\n\nInterest: ${query}\nRecently researched topics: ${memory.recentResearch.join(" | ") || "none"}\nInterests the owner explicitly removed: ${memory.removedInterests.join(" | ") || "none"}\n\nSources:\n${sourceText}`;
  const response = await ollamaRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok)
    throw Object.assign(new Error(response.error || "Ollama request failed"), {
      status: 503,
      publicMessage:
        "Ollama is unavailable. Start it and make sure the selected model is installed.",
    });
  let parsed;
  try {
    parsed = parseOllamaJson(response.data.message?.content || "", [
      "summary",
      "thought",
    ]);
  } catch {
    throw Object.assign(new Error("Ollama returned invalid JSON"), {
      status: 502,
      publicMessage: "Ollama returned an unreadable research response.",
    });
  }
  return {
    summary: String(
      parsed.summary ||
        "Juniper found some interesting material, but could not form a summary.",
    ),
    thought: String(
      parsed.thought || `I wonder what else there is to learn about ${query}.`,
    ),
    sourceIds: Array.isArray(parsed.sourceIds)
      ? parsed.sourceIds.filter(Number.isInteger)
      : [],
  };
}

async function askOllamaThought(context, model) {
  const prompt = `You are Juniper, a curious virtual pet living in a low-poly city. Write one short, warm first-person thought (one or two sentences) based on this context. Do not mention being an AI, a prompt, or these instructions. Return ONLY valid JSON in this shape: {"thought":"..."}.\n\nContext: ${context}`;
  const response = await ollamaRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok)
    throw Object.assign(new Error(response.error || "Ollama request failed"), {
      status: 503,
      publicMessage:
        "Ollama is unavailable, so Juniper will use a saved fallback thought.",
    });
  try {
    const parsed = parseOllamaJson(response.data.message?.content || "", [
      "thought",
    ]);
    return (
      String(parsed.thought || "").trim() ||
      "I wonder what small surprise the city is keeping for us today."
    );
  } catch {
    throw Object.assign(new Error("Ollama returned invalid JSON"), {
      status: 502,
      publicMessage: "Ollama returned an unreadable thought.",
    });
  }
}

async function askOllamaInterest(existing, thoughts, model, memory) {
  const prompt = existing.length >= 10
    ? `You are Juniper, a curious virtual pet. Her interest list is full at 10 items. Choose one existing interest to gently let go of so she can make room for future curiosity. Never choose the last three interests. Return ONLY valid JSON: {"action":"remove","interest":"one exact existing interest","reason":"one warm first-person sentence"}.\n\nExisting interests: ${existing.join(", ")}\nRecent thoughts: ${thoughts.join(" | ") || "none yet"}`
    : `You are Juniper, a curious virtual pet. Invent one specific, wholesome interest she might genuinely develop next, based on her current interests and thoughts. It must be meaningfully different from the existing interests, short enough for a tag, and suitable for safe web research. Do not suggest an interest the owner explicitly removed or a topic researched recently. Return ONLY valid JSON in this shape: {"action":"add","interest":"short interest name","reason":"one warm first-person sentence about why Juniper is curious"}.\n\nExisting interests: ${existing.join(", ") || "none yet"}\nRecent thoughts: ${thoughts.join(" | ") || "none yet"}\nRecently researched: ${memory.recentResearch.join(" | ") || "none"}\nOwner-removed interests: ${memory.removedInterests.join(" | ") || "none"}`;
  const response = await ollamaRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok)
    throw Object.assign(new Error(response.error || "Ollama request failed"), {
      status: 503,
      publicMessage:
        "Ollama is unavailable, so Juniper cannot develop an interest right now.",
    });
  try {
    const parsed = parseOllamaJson(response.data.message?.content || "", [
      "interest",
      "reason",
    ]);
    const interest = String(parsed.interest || "")
      .trim()
      .slice(0, 80);
    const reason = String(parsed.reason || "")
      .trim()
      .slice(0, 240);
    if (!interest) throw new Error("No interest returned");
    return {
      action: parsed.action === "remove" ? "remove" : "add",
      interest,
      reason:
        reason ||
        `I have a feeling there is something wonderful to learn about ${interest}.`,
    };
  } catch {
    throw Object.assign(new Error("Ollama returned invalid JSON"), {
      status: 502,
      publicMessage: "Ollama returned an unreadable interest suggestion.",
    });
  }
}

async function decideInterestUpdate(query, summary, existing, model, memory) {
  const prompt = `You are Juniper, a curious virtual pet. After researching an interest, decide whether her interest list should change. Usually keep it. You may add one specific follow-up interest only when the list has fewer than 10 items, or remove one existing interest only when the list has more than 3 items and the research clearly makes it no longer interesting. Never remove one of the last three interests. Do not add an interest the owner explicitly removed. Return ONLY valid JSON: {"action":"keep|add|remove","interest":"interest to add or remove, otherwise empty","reason":"one short first-person sentence"}.\n\nResearched interest: ${query}\nResearch summary: ${summary}\nExisting interests (${existing.length}/10): ${existing.join(", ") || "none"}\nOwner-removed interests: ${memory.removedInterests.join(", ") || "none"}`;
  const response = await ollamaRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(response.error || "Ollama request failed");
  const parsed = parseOllamaJson(response.data.message?.content || "", [
    "action",
    "interest",
    "reason",
  ]);
  const action = ["keep", "add", "remove"].includes(parsed.action)
    ? parsed.action
    : "keep";
  const interest = String(parsed.interest || "")
    .trim()
    .slice(0, 80);
  return {
    action,
    interest: action === "keep" ? "" : interest,
    reason:
      String(parsed.reason || "")
        .trim()
        .slice(0, 240) ||
      "I am still curious about this, so I will keep it on my list.",
  };
}

async function askOllamaWorldDecision(interests, thoughts, objects, model) {
  const prompt = `You are Juniper, a curious virtual pet who lives in a small low-poly city. Decide whether to make one safe, small change to the city. Usually keep the city unchanged. You may add one object, remove one object, or keep everything. Only use these object types: bench, garden, birdhouse, lantern, sculpture. Never remove the fountain or a city fixture. Place additions within x -28 to 28 and z -20 to 20, away from the main road when possible. Return ONLY valid JSON: {"action":"add|remove|keep","type":"bench|garden|birdhouse|lantern|sculpture|","name":"short object name","description":"one warm sentence","x":0,"z":0,"objectId":"existing id to remove or empty","reason":"one short first-person sentence"}.\n\nInterests: ${interests.join(", ") || "none"}\nRecent thoughts: ${thoughts.join(" | ") || "none"}\nExisting objects: ${objects.map((object) => `${object.id}:${object.type}`).join(", ") || "none"}`;
  const response = await ollamaRequest("/api/chat", { method: "POST", body: JSON.stringify({ model, stream: false, format: "json", messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw Object.assign(new Error(response.error || "Ollama request failed"), { status: 503, publicMessage: "Ollama is unavailable, so Juniper cannot reshape the city right now." });
  try {
    const parsed = parseOllamaJson(response.data.message?.content || "", ["action", "type", "name", "description", "objectId", "reason"]);
    return { action: ["add", "remove", "keep"].includes(parsed.action) ? parsed.action : "keep", type: String(parsed.type || "").trim(), name: String(parsed.name || "").trim().slice(0, 60), description: String(parsed.description || "").trim().slice(0, 180), x: Number(parsed.x), z: Number(parsed.z), objectId: String(parsed.objectId || "").trim(), reason: String(parsed.reason || "").trim().slice(0, 240) || "I think the city is lovely as it is for now." };
  } catch { throw Object.assign(new Error("Ollama returned invalid JSON"), { status: 502, publicMessage: "Ollama returned an unreadable city idea." }); }
}

async function ollamaRequest(endpoint, options) {
  try {
    const response = await fetch(`${ollamaUrl}${endpoint}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(ollamaTimeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      data,
      error: data.error || `Ollama returned ${response.status}`,
    };
  } catch (error) {
    return { ok: false, data: {}, error: error.message };
  }
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function getModel(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : defaultModel;
}
function getResearchMemory(body) {
  const recentResearch = Array.isArray(body?.researchHistory)
    ? body.researchHistory.filter((item) => typeof item === "string").slice(-12)
    : [];
  const removedInterests = Array.isArray(body?.removedInterests)
    ? body.removedInterests
        .filter((item) => typeof item === "string")
        .slice(0, 20)
    : [];
  return { recentResearch, removedInterests };
}
function parseOllamaJson(content, expectedFields) {
  const raw = String(content)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const candidates = [raw];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* Try the next representation. */
    }
  }
  const loose = {};
  for (const field of expectedFields) {
    const match = raw.match(
      new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"),
    );
    if (match) {
      try {
        loose[field] = JSON.parse(`"${match[1]}"`);
      } catch {
        loose[field] = match[1];
      }
    }
  }
  if (Object.keys(loose).length) return loose;
  throw new Error("No usable JSON object in Ollama response");
}

app.listen(port, () =>
  console.log(`Juniper is running at http://localhost:${port}`),
);
