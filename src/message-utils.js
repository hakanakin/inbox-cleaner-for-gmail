const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CATEGORY_NAMES = Object.freeze(["KEEP", "REVIEW", "CLEAN"]);

export function senderLabel(from = "") {
  const normalizedFrom = String(from);
  const label = normalizedFrom
    .replace(/<[^>]+>/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  return label || normalizedFrom;
}

export function senderEmail(from = "") {
  const normalizedFrom = String(from);
  const angleAddress = normalizedFrom.match(/<([^>]+)>/);
  const plainAddress = normalizedFrom.match(EMAIL_PATTERN);
  const angleEmail = angleAddress?.[1].match(EMAIL_PATTERN)?.[0];
  return (angleEmail || plainAddress?.[0] || "").trim().toLocaleLowerCase();
}

export function findUnsubscribeUrl(messages) {
  const candidates = messages.flatMap((message) => {
    const rawHeader = message.headers?.["list-unsubscribe"] || "";
    const bracketedValues = [...rawHeader.matchAll(/<([^>]+)>/g)]
      .map((match) => match[1].trim());

    return bracketedValues.length
      ? bracketedValues
      : rawHeader.split(",").map((value) => value.trim());
  });

  return [...new Set(candidates)].find((value) => /^https:/i.test(value)) || "";
}

export function countByCategory(messages) {
  const counts = Object.fromEntries(CATEGORY_NAMES.map((category) => [category, 0]));
  for (const message of messages) {
    if (message.category in counts) counts[message.category] += 1;
  }
  return counts;
}

export function dominantCategory(messages) {
  const counts = countByCategory(messages);
  if (counts.CLEAN) return "CLEAN";
  if (counts.REVIEW) return "REVIEW";
  return "KEEP";
}

export function countThreads(messages) {
  return new Set(messages.map((message) => message.threadId).filter(Boolean)).size;
}

export function groupMessagesBySender(messages, searchQuery = "") {
  const groups = new Map();

  for (const message of messages) {
    const email = senderEmail(message.from);
    const key = email || String(message.from || "").toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, { email, messages: [] });
    groups.get(key).messages.push(message);
  }

  const sortedGroups = [...groups.values()].sort((left, right) => {
    if (right.messages.length !== left.messages.length) {
      return right.messages.length - left.messages.length;
    }
    return senderLabel(left.messages[0].from)
      .localeCompare(senderLabel(right.messages[0].from));
  });

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  if (!normalizedQuery) return sortedGroups;

  return sortedGroups.filter(({ email, messages: groupedMessages }) => {
    const firstMessage = groupedMessages[0];
    const searchText = [senderLabel(firstMessage.from), email, firstMessage.from]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchText.includes(normalizedQuery);
  });
}

export function frequentSenderEmails(messages, limit = 30) {
  const counts = new Map();

  for (const message of messages) {
    if (message.category === "KEEP") continue;
    const email = senderEmail(message.from);
    if (email) counts.set(email, (counts.get(email) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([email]) => email);
}

export function selectedConversationCount(messages, summaries, selectedIds) {
  const threadIds = new Set();
  const collectSelectedThreads = (items = []) => {
    for (const message of items) {
      if (selectedIds.has(message.id) && message.threadId) threadIds.add(message.threadId);
    }
  };

  collectSelectedThreads(messages);
  for (const summary of summaries.values()) collectSelectedThreads(summary.references);
  return threadIds.size;
}

export function removeMessagesFromSummaries(summaries, removedIds) {
  for (const [email, summary] of summaries) {
    const references = (summary.references || [])
      .filter((message) => !removedIds.has(message.id));
    const messageIds = (summary.messageIds || [])
      .filter((id) => !removedIds.has(id));

    if (!messageIds.length) {
      summaries.delete(email);
      continue;
    }

    const threadIds = [...new Set(references.map((message) => message.threadId).filter(Boolean))];
    summaries.set(email, {
      ...summary,
      references,
      messageIds,
      threadIds,
      threadCount: threadIds.length,
    });
  }
}
