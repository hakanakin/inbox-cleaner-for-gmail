import { t } from "./i18n.js";

const API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RETRIES = 6;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const CACHE_KEY = "gmailMessageCacheV1";
const CONNECTION_STATE_KEY = "gmailConnectionEnabledV1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_ENTRY_LIMIT = 500;
const MAX_SCAN_RESULTS = 250;
const MAX_SENDER_RESULTS = 1000;
const BATCH_MODIFY_LIMIT = 1000;

const MESSAGE_METADATA_HEADERS = Object.freeze([
  "From",
  "To",
  "Subject",
  "Date",
  "List-Unsubscribe",
]);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfterSeconds = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(32000, 1000 * (2 ** attempt)) + Math.floor(Math.random() * 1000);
}

function clampResultLimit(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), maximum);
}

function isQuotaLimited(response, responseBody) {
  if (response.status !== 403) return false;
  return ["rateLimitExceeded", "RATE_LIMIT_EXCEEDED", "Quota exceeded"]
    .some((message) => responseBody.includes(message));
}

function metadataPath(messageId) {
  const params = new URLSearchParams({ format: "metadata" });
  for (const header of MESSAGE_METADATA_HEADERS) {
    params.append("metadataHeaders", header);
  }
  return `/messages/${encodeURIComponent(messageId)}?${params.toString()}`;
}

async function getToken(interactive = true) {
  const result = await chrome.identity.getAuthToken({ interactive });
  if (!result?.token) throw new Error(t("authTokenMissing"));
  return result.token;
}

async function request(path, options = {}) {
  let authRetried = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const token = await getToken(true);
    const response = await fetch(API_ROOT + path, {
      ...options,
      headers: { Authorization: "Bearer " + token, ...(options.headers || {}) },
    });

    if (response.status === 401 && !authRetried) {
      await chrome.identity.removeCachedAuthToken({ token });
      authRetried = true;
      attempt -= 1;
      continue;
    }

    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }

    const body = await response.text();
    const quotaLimited = isQuotaLimited(response, body);

    if ((RETRYABLE_STATUSES.has(response.status) || quotaLimited) && attempt < MAX_RETRIES) {
      await wait(retryDelay(response, attempt));
      continue;
    }

    if (quotaLimited) {
      throw new Error(t("rateLimited"));
    }
    throw new Error(t("gmailApiError", {
      status: response.status,
      detail: body || response.statusText,
    }));
  }

  throw new Error(t("requestFailed"));
}

async function mapWithConcurrency(items, mapper, onProgress) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      completedCount += 1;
      onProgress?.(completedCount, items.length);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function connect() {
  await getToken(true);
  await chrome.storage.local.set({ [CONNECTION_STATE_KEY]: true });
}

async function revokeToken(token) {
  if (!token || typeof document === "undefined" || !document.body) return;

  // Google's revocation endpoint does not support CORS. A hidden form sends
  // the standards-compliant POST without adding another host permission.
  const targetName = "oauth-revoke-" + crypto.randomUUID();
  const target = document.createElement("iframe");
  target.name = targetName;
  target.hidden = true;

  const form = document.createElement("form");
  form.method = "post";
  form.action = TOKEN_REVOCATION_ENDPOINT;
  form.target = targetName;
  form.hidden = true;

  const tokenField = document.createElement("input");
  tokenField.type = "hidden";
  tokenField.name = "token";
  tokenField.value = token;
  form.append(tokenField);
  document.body.append(target, form);

  try {
    form.submit();
    // Give the browser enough time to dispatch the request before cleanup.
    await wait(1500);
  } finally {
    form.remove();
    target.remove();
  }
}

export async function disconnect() {
  let token = "";
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });
    token = result?.token || "";
  } catch {
    // A missing or expired token should not prevent local sign-out.
  }

  try {
    if (token) await revokeToken(token);
  } catch {
    // Local sign-out must still complete if Google cannot be reached.
  } finally {
    if (token) {
      try {
        await chrome.identity.removeCachedAuthToken({ token });
      } catch {
        // clearAllCachedAuthTokens below remains the authoritative cleanup.
      }
    }
    try {
      await chrome.identity.clearAllCachedAuthTokens();
    } finally {
      await chrome.storage.local.remove(CACHE_KEY);
      await chrome.storage.local.set({ [CONNECTION_STATE_KEY]: false });
    }
  }
}

export async function hasCachedToken() {
  const stored = await chrome.storage.local.get(CONNECTION_STATE_KEY);
  if (stored[CONNECTION_STATE_KEY] === false) return false;
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });
    const connected = Boolean(result?.token);
    if (connected) await chrome.storage.local.set({ [CONNECTION_STATE_KEY]: true });
    return connected;
  } catch {
    return false;
  }
}

export async function getProfile() {
  return request("/profile");
}

function compactMessage(message) {
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet || "",
    payload: {
      headers: message.payload?.headers || [],
    },
  };
}

async function loadMessageCache(accountEmail) {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const cache = stored[CACHE_KEY];
    if (!cache || cache.accountEmail !== accountEmail) return {};
    const cutoff = Date.now() - CACHE_TTL_MS;
    return Object.fromEntries(
      Object.entries(cache.entries || {}).filter(([, entry]) => entry.fetchedAt >= cutoff),
    );
  } catch {
    return {};
  }
}

async function saveMessageCache(accountEmail, entries) {
  try {
    const newest = Object.entries(entries)
      .sort(([, left], [, right]) => right.fetchedAt - left.fetchedAt)
      .slice(0, CACHE_ENTRY_LIMIT);
    await chrome.storage.local.set({
      [CACHE_KEY]: { accountEmail, entries: Object.fromEntries(newest) },
    });
  } catch {
    // A cache failure should never prevent a scan from completing.
  }
}

async function removeCachedMessages(ids) {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const cache = stored[CACHE_KEY];
    if (!cache?.entries) return;
    ids.forEach((id) => { delete cache.entries[id]; });
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  } catch {
    // The next inbox listing will still exclude messages moved to Trash.
  }
}

export async function listInboxMessages(maxResults = 200, onProgress) {
  const limit = clampResultLimit(maxResults, 200, MAX_SCAN_RESULTS);
  const messageRefs = [];
  let pageToken = "";

  do {
    const remaining = limit - messageRefs.length;
    const params = new URLSearchParams({
      labelIds: "INBOX",
      maxResults: String(Math.min(remaining, 250)),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await request("/messages?" + params.toString());
    messageRefs.push(...(page.messages || []).slice(0, remaining));
    pageToken = page.nextPageToken || "";
  } while (pageToken && messageRefs.length < limit);

  const profile = await getProfile();
  const cacheEntries = await loadMessageCache(profile.emailAddress);
  const resultById = new Map();
  const missingRefs = [];

  messageRefs.forEach((messageRef) => {
    const cached = cacheEntries[messageRef.id];
    if (cached?.message) resultById.set(messageRef.id, cached.message);
    else missingRefs.push(messageRef);
  });

  const cachedCount = resultById.size;
  if (cachedCount) onProgress?.(cachedCount, messageRefs.length);

  const fetched = await mapWithConcurrency(
    missingRefs,
    ({ id }) => request(metadataPath(id)),
    (completed) => onProgress?.(cachedCount + completed, messageRefs.length),
  );

  fetched.forEach((message) => {
    const compact = compactMessage(message);
    resultById.set(message.id, compact);
    cacheEntries[message.id] = { fetchedAt: Date.now(), message: compact };
  });
  await saveMessageCache(profile.emailAddress, cacheEntries);
  return messageRefs.map(({ id }) => resultById.get(id)).filter(Boolean);
}

export async function getInboxSenderSummary(senderEmail, maxResults = 1000) {
  const limit = clampResultLimit(maxResults, MAX_SENDER_RESULTS, MAX_SENDER_RESULTS);
  const references = [];
  let pageToken = "";

  do {
    const remaining = limit - references.length;
    const params = new URLSearchParams({
      labelIds: "INBOX",
      maxResults: String(Math.min(remaining, 500)),
      q: `from:${senderEmail}`,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await request("/messages?" + params.toString());
    references.push(...(page.messages || []).slice(0, remaining));
    pageToken = page.nextPageToken || "";
  } while (pageToken && references.length < limit);

  const uniqueReferences = [...new Map(references.map((message) => [message.id, message])).values()];
  const threadIds = [...new Set(uniqueReferences.map((message) => message.threadId).filter(Boolean))];
  return {
    references: uniqueReferences,
    messageIds: uniqueReferences.map((message) => message.id),
    threadIds,
    threadCount: threadIds.length,
    truncated: Boolean(pageToken),
  };
}

export async function trashMessages(ids) {
  if (!ids.length) return;
  for (let index = 0; index < ids.length; index += BATCH_MODIFY_LIMIT) {
    await request("/messages/batchModify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: ids.slice(index, index + BATCH_MODIFY_LIMIT),
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX"],
      }),
    });
  }
  await removeCachedMessages(ids);
}
