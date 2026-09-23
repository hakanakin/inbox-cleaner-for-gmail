import { buildSignals } from "./rules.js";

export const CATEGORIES = Object.freeze({
  KEEP: "KEEP",
  REVIEW: "REVIEW",
  CLEAN: "CLEAN",
});

const CATEGORY_THRESHOLDS = Object.freeze({
  REVIEW: 2,
  CLEAN: 4,
});

const SIGNAL_RULES = Object.freeze([
  { key: "promotion", weight: 3, reason: "promotion language" },
  { key: "social", weight: 3, reason: "social notification" },
  { key: "automated", weight: 1, reason: "automated sender" },
]);

function categoryForScore(score) {
  if (score >= CATEGORY_THRESHOLDS.CLEAN) return CATEGORIES.CLEAN;
  if (score >= CATEGORY_THRESHOLDS.REVIEW) return CATEGORIES.REVIEW;
  return CATEGORIES.KEEP;
}

function scoreSignals(signals, reviewDays) {
  const result = { score: 0, reasons: [] };

  for (const rule of SIGNAL_RULES) {
    if (!signals[rule.key]) continue;
    result.score += rule.weight;
    result.reasons.push(rule.reason);
  }

  if (signals.ageDays >= reviewDays) {
    result.score += 1;
    result.reasons.push(`${Math.floor(signals.ageDays)} days old`);
  }

  return result;
}

export function classifyMessage(message, settings) {
  const signals = buildSignals(message, settings);

  if (signals.senderKept) {
    return {
      id: message.id,
      threadId: message.threadId,
      category: CATEGORIES.KEEP,
      score: -5,
      reasons: ["trusted sender"],
      ...signals,
    };
  }

  const { score, reasons } = scoreSignals(signals, settings.reviewDays);
  return {
    id: message.id,
    threadId: message.threadId,
    category: categoryForScore(score),
    score,
    reasons,
    ...signals,
  };
}

export function classifyMessages(messages, settings) {
  return messages.map((message) => classifyMessage(message, settings));
}
