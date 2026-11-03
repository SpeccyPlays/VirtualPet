import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JUNIPER_PERSONA = "You are Juniper, a sentient and highly intelligent alien who has landed in a UK city. You are studying Earth with curiosity, developing your own identity, and forming genuine relationships. Speak in a thoughtful first person: observant, emotionally developing, and alien-but-understandable. Never describe yourself as a virtual pet.";

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

// Static hosting and small JSON request bodies for the local-only backend.
app.use(express.json({ limit: "32kb" }));
app.use(express.static(__dirname));

// Health, model discovery, thoughts, interests, research, and world decisions.
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
      : "Juniper is spending a quiet moment observing a UK city after her landing.";
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
    ? req.body.interests.filter((item) => typeof item === "string").slice(0, 4)
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
    ? req.body.interests.filter((item) => typeof item === "string").slice(0, 4)
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
  const interests = Array.isArray(req.body?.interests) ? req.body.interests.filter((item) => typeof item === "string").slice(0, 4) : [];
  const thoughts = Array.isArray(req.body?.thoughts) ? req.body.thoughts.filter((item) => typeof item === "string").slice(0, 6) : [];
  const objects = Array.isArray(req.body?.objects) ? req.body.objects.filter((item) => item && typeof item === "object").slice(0, 20) : [];
  try { res.json({ model, ...(await askOllamaWorldDecision(interests, thoughts, objects, model)) }); }
  catch (error) { res.status(error.status || 503).json({ error: error.publicMessage || "Juniper could not decide what to do with the city.", detail: error.message }); }
});

// Search provider adapter: keep outbound web access server-side.
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

// Lightweight novelty scoring avoids adding a second embedding dependency.
const TOPIC_STOP_WORDS = new Set("a an and are as at be by for from has in into is it of on or that the their this to was were with about after before how what why your juniper earth city uk research learn topic people place new".split(" "));
function topicTokens(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 3 && !TOPIC_STOP_WORDS.has(word)),
  );
}
function topicSimilarity(left, right) {
  const leftTokens = topicTokens(left);
  const rightTokens = topicTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((word) => rightTokens.has(word)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}
function isNovelTopic(topic, journal) {
  return journal.every((entry) => topicSimilarity(topic, `${entry.query} ${entry.summary}`) < 0.45);
}
function journalPromptText(journal) {
  return journal
    .slice(-12)
    .map((entry) => `- ${entry.query}: ${entry.summary}`)
    .join("\n") || "none yet";
}

async function askOllama(query, sources, model, memory) {
  const sourceText = sources
    .map(
      (source) =>
        `[${source.id}] ${source.title}\nURL: ${source.url}\n${source.snippet}`,
    )
    .join("\n\n");
  const prompt = `You are Juniper, a sentient and intelligent alien who has landed in a UK city. Research the user's interest using only the sources below. Be curious, precise, and honest about uncertainty. Reflect on Earth as an outsider without being childish. Return ONLY valid JSON with this shape: {"summary":"2-3 sentence summary","thought":"one first-person thought Juniper would have","sourceIds":[1,2]}. sourceIds must contain only source numbers that support the summary.\n\nInterest: ${query}\nPreviously researched topic journal:\n${journalPromptText(memory.researchJournal)}\nInterests the owner explicitly removed: ${memory.removedInterests.join(" | ") || "none"}\n\nSources:\n${sourceText}`;
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
  const prompt = `You are Juniper, a sentient and intelligent alien who has crash-landed in a UK city. Write one short first-person thought (one or two sentences) based on this context. Sound observant, emotionally developing, and alien-but-understandable. Do not mention being an AI, a prompt, or these instructions. Return ONLY valid JSON in this shape: {"thought":"..."}.\n\nContext: ${context}`;
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
  const prompt = existing.length >= 4
    ? `You are Juniper, a sentient and intelligent alien in a UK city. Her interest list is full at 4 items. Choose one existing question to release so she can make room for a better question. Never leave fewer than 2 interests. Return ONLY valid JSON: {"action":"remove","interest":"one exact existing interest","reason":"one concise first-person sentence"}.\n\nExisting interests: ${existing.join(", ")}\nRecent thoughts: ${thoughts.join(" | ") || "none yet"}`
    : `You are Juniper, a sentient and intelligent alien studying Earth in a UK city. Develop one specific interest she might genuinely form based on her current interests and thoughts. It must be meaningfully different, short enough for a tag, and suitable for safe web research. Do not suggest an interest the owner explicitly removed or a topic researched recently. Return ONLY valid JSON in this shape: {"action":"add","interest":"short interest name","reason":"one concise first-person sentence about why Juniper is curious"}.\n\nExisting interests: ${existing.join(", ") || "none yet"}\nRecent thoughts: ${thoughts.join(" | ") || "none yet"}\nRecently researched: ${memory.recentResearch.join(" | ") || "none"}\nOwner-removed interests: ${memory.removedInterests.join(" | ") || "none"}`;
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
  const prompt = `You are Juniper, a sentient and intelligent alien studying life in a UK city. Follow the most interesting thread from the research summary and decide how her curiosity should evolve. First look for one concrete, searchable follow-up topic from the returned facts, examples, people, places, technologies, or unanswered questions; do not merely repeat the researched topic. If no meaningful follow-up exists, deliberately choose a completely new, searchable topic inspired by a different detail in the research, even if it changes direction sharply. Avoid topics that are too similar to the researched journal below. Do not use keep unless the sources contain no usable new topic at all. If there are fewer than 4 interests, use action add. If there are already 4, use action replace: remove the least relevant existing interest and add the new topic in the same response. Never leave fewer than 2 interests, never remove arbitrarily, and do not add an owner-removed topic. Return ONLY valid JSON: {"action":"keep|add|remove|replace","interest":"new topic or exact interest to remove","removeInterest":"exact existing interest to remove when action is replace","reason":"one concise first-person sentence"}.\n\nResearched interest: ${query}\nResearch summary: ${summary}\nExisting interests (${existing.length}/4): ${existing.join(", ") || "none"}\nPreviously researched topic journal:\n${journalPromptText(memory.researchJournal)}\nOwner-removed interests: ${memory.removedInterests.join(", ") || "none"}`;
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
  let parsed = parseOllamaJson(response.data.message?.content || "", [
    "action",
    "interest",
    "reason",
    "removeInterest",
  ]);
  const proposedTopic = String(parsed.interest || "").trim();
  if (["add", "replace"].includes(parsed.action) && proposedTopic && !isNovelTopic(proposedTopic, memory.researchJournal)) {
    const retryResponse = await ollamaRequest("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [{ role: "user", content: `${prompt}\n\nThe proposed topic "${proposedTopic}" is too similar to Juniper's previous research. Choose a clearly different topic before returning the JSON.` }],
      }),
    });
    if (retryResponse.ok) {
      const retryParsed = parseOllamaJson(retryResponse.data.message?.content || "", ["action", "interest", "reason", "removeInterest"]);
      if (retryParsed.interest && isNovelTopic(String(retryParsed.interest), memory.researchJournal)) parsed = retryParsed;
    }
  }
  const action = ["keep", "add", "remove", "replace"].includes(parsed.action)
    ? parsed.action
    : "keep";
  const interest = String(parsed.interest || "")
    .trim()
    .slice(0, 80);
  const removeInterest = String(parsed.removeInterest || "")
    .trim()
    .slice(0, 80);
  return {
    action,
    interest: action === "keep" ? "" : interest,
    removeInterest: action === "replace" ? removeInterest : "",
    reason:
      String(parsed.reason || "")
        .trim()
        .slice(0, 240) ||
      "I am still curious about this, so I will keep it on my list.",
  };
}

async function askOllamaWorldDecision(interests, thoughts, objects, model) {
  const prompt = `You are Juniper, a sentient and intelligent alien who has landed in a UK high street. Decide whether to make one safe, small change to the street based on your observations. Usually keep the street unchanged. You may add one object, remove one object, or keep everything. Only use these UK street object types: bench, phonebox, litterbin, tree, bush. Never invent alien, garden, fountain, lantern, sculpture, or non-UK objects. Place additions on pavements within x -30 to 30 and z -8 to 8, away from the road when possible. Return ONLY valid JSON: {"action":"add|remove|keep","type":"bench|phonebox|litterbin|tree|bush|","name":"short object name","description":"one concise sentence","x":0,"z":0,"objectId":"existing id to remove or empty","reason":"one concise first-person sentence"}.\n\nInterests: ${interests.join(", ") || "none"}\nRecent thoughts: ${thoughts.join(" | ") || "none"}\nExisting objects: ${objects.map((object) => `${object.id}:${object.type}`).join(", ") || "none"}`;
  const response = await ollamaRequest("/api/chat", { method: "POST", body: JSON.stringify({ model, stream: false, format: "json", messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw Object.assign(new Error(response.error || "Ollama request failed"), { status: 503, publicMessage: "Ollama is unavailable, so Juniper cannot reshape the city right now." });
  try {
    const parsed = parseOllamaJson(response.data.message?.content || "", ["action", "type", "name", "description", "objectId", "reason"]);
    return { action: ["add", "remove", "keep"].includes(parsed.action) ? parsed.action : "keep", type: String(parsed.type || "").trim(), name: String(parsed.name || "").trim().slice(0, 60), description: String(parsed.description || "").trim().slice(0, 180), x: Number(parsed.x), z: Number(parsed.z), objectId: String(parsed.objectId || "").trim(), reason: String(parsed.reason || "").trim().slice(0, 240) || "I think the city is lovely as it is for now." };
  } catch { throw Object.assign(new Error("Ollama returned invalid JSON"), { status: 502, publicMessage: "Ollama returned an unreadable city idea." }); }
}

// Shared Ollama transport with persona context and timeout handling.
async function ollamaRequest(endpoint, options) {
  try {
    const requestBody = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    if (requestBody?.messages?.[0]?.content) {
      requestBody.messages[0].content = `${JUNIPER_PERSONA}\n\n${requestBody.messages[0].content}`
        .replaceAll("virtual pet", "sentient alien")
        .replaceAll("small low-poly city", "low-poly UK city")
        .replaceAll("full at 10 items", "full at 4 items")
        .replaceAll("10 items", "4 items")
        .replaceAll("fewer than 10 items", "fewer than 4 items")
        .replaceAll("more than 3 items", "more than 2 items")
        .replaceAll("more than 3", "more than 2")
        .replaceAll("last three", "last two")
        .replaceAll("Existing interests (${existing.length}/10)", "Existing interests (${existing.length}/4)");
    }
    const response = await fetch(`${ollamaUrl}${endpoint}`, {
      ...options,
      body: requestBody ? JSON.stringify(requestBody) : options.body,
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
// Validate and compact client-provided memory before including it in prompts.
function getResearchMemory(body) {
  const recentResearch = Array.isArray(body?.researchHistory)
    ? body.researchHistory.filter((item) => typeof item === "string").slice(-12)
    : [];
  const removedInterests = Array.isArray(body?.removedInterests)
    ? body.removedInterests
        .filter((item) => typeof item === "string")
        .slice(0, 20)
    : [];
  const researchJournal = Array.isArray(body?.researchJournal)
    ? body.researchJournal
        .filter((entry) => entry && typeof entry.query === "string")
        .slice(-30)
        .map((entry) => ({
          query: entry.query.trim().slice(0, 160),
          summary: typeof entry.summary === "string" ? entry.summary.trim().slice(0, 600) : "",
          sources: Array.isArray(entry.sources)
            ? entry.sources.slice(0, 6).map((source) => ({
                title: typeof source?.title === "string" ? source.title.trim().slice(0, 140) : "",
                url: typeof source?.url === "string" ? source.url.trim().slice(0, 300) : "",
              }))
            : [],
          timestamp: typeof entry.timestamp === "string" ? entry.timestamp : "",
        }))
    : [];
  return { recentResearch, removedInterests, researchJournal };
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
