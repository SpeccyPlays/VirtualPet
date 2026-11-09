// Fresh topics are written by Ollama; domains only diversify its prompt.
const domains = ["astronomy", "music", "architecture", "marine life", "inventions", "geology", "food traditions", "languages", "mathematics", "crafts", "ancient history", "weather"];
export async function recoverInterestDecision(decision, { existing, removed, query, isNovel, generate, random = Math.random }) {
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const blocked = new Set([...existing, ...removed, query].map(normalize));
  const fresh = (value) => typeof value === "string" && value.trim() && value.trim().length <= 80 && !blocked.has(normalize(value)) && isNovel(value);
  const target = existing.find((item) => normalize(item) === normalize(decision.removeInterest));
  const valid = decision.action === "keep"
    || (decision.action === "remove" && existing.length > 2 && existing.some((item) => normalize(item) === normalize(decision.interest)))
    || (decision.action === "add" && existing.length < 4 && fresh(decision.interest))
    || (decision.action === "replace" && target && fresh(decision.interest));
  if (valid) return decision;
  const rejected = [decision.interest].filter(Boolean);
  for (let attempt = 0; attempt < 2; attempt++) {
    const domain = domains[(Math.floor(random() * domains.length) + attempt) % domains.length];
    try {
      const proposal = await generate({ domain, rejected });
      if (!fresh(proposal.interest)) { rejected.push(String(proposal.interest || "")); continue; }
      // Preserve count for replacements/full lists, keeping at least two interests.
      const replace = decision.action === "replace" || existing.length >= 4;
      const removeInterest = replace ? target || existing.find((item) => normalize(item) === normalize(query)) || existing.at(-1) : "";
      return { action: replace ? "replace" : "add", interest: proposal.interest.trim(), removeInterest,
        reason: String(proposal.reason || "I want to explore a completely different question.").slice(0, 240) };
    } catch { /* One bounded retry; unavailable models must not erase interests. */ }
  }
  return { action: "keep", interest: "", removeInterest: "", fallbackFailed: true,
    reason: "Juniper could not choose a valid fresh interest, so her interests stayed unchanged." };
}
