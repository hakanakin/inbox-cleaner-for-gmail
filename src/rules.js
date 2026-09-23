const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PROMOTION_TERMS = Object.freeze([
  "sale",
  "off",
  "deal",
  "discount",
  "promo",
  "promotion",
  "offer",
  "coupon",
  "clearance",
  "unsubscribe",
]);

const SOCIAL_TERMS = Object.freeze([
  "liked",
  "commented",
  "mentioned",
  "follow",
  "friend request",
  "notification",
  "social",
]);

const AUTOMATED_TERMS = Object.freeze([
  "noreply",
  "no-reply",
  "notifications@",
  "newsletter",
  "updates@",
  "mailer-daemon",
]);

function includesAny(value, terms) {
  const normalizedValue = String(value || "").toLocaleLowerCase();
  return terms.some((term) => normalizedValue.includes(term));
}

function extractHeaders(message) {
  const headerEntries = Array.isArray(message?.payload?.headers)
    ? message.payload.headers
    : [];

  return Object.fromEntries(
    headerEntries
      .filter((header) => header?.name)
      .map(({ name, value }) => [name.toLocaleLowerCase(), value || ""]),
  );
}

function ageInDays(dateValue, now = Date.now()) {
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (now - timestamp) / MILLISECONDS_PER_DAY);
}

function matchesTrustedSender(from, keepSenders) {
  const normalizedFrom = from.toLocaleLowerCase();
  return keepSenders.some((sender) => normalizedFrom.includes(sender.toLocaleLowerCase()));
}

export function buildSignals(message, settings) {
  const headers = extractHeaders(message);
  const subject = headers.subject || "(no subject)";
  const from = headers.from || "";
  const snippet = message?.snippet || "";
  const searchableText = `${subject} ${from} ${snippet}`;
  const keepSenders = Array.isArray(settings.keepSenders) ? settings.keepSenders : [];

  return {
    headers,
    subject,
    from,
    snippet,
    ageDays: ageInDays(headers.date),
    senderKept: matchesTrustedSender(from, keepSenders),
    promotion: Boolean(settings.cleanPromotions)
      && includesAny(searchableText, PROMOTION_TERMS),
    social: Boolean(settings.cleanSocial)
      && includesAny(searchableText, SOCIAL_TERMS),
    automated: includesAny(searchableText, AUTOMATED_TERMS),
  };
}
