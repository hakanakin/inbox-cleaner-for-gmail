import {
  connect,
  disconnect as disconnectGmail,
  getInboxSenderSummary,
  getProfile,
  hasCachedToken,
  listInboxMessages,
  trashMessages,
} from "./src/gmail-client.js";
import { classifyMessages } from "./src/classifier.js";
import { initI18n, t } from "./src/i18n.js";
import {
  countByCategory,
  frequentSenderEmails,
  groupMessagesBySender,
  removeMessagesFromSummaries,
  selectedConversationCount,
} from "./src/message-utils.js";
import { createSenderRow } from "./src/sender-row.js";
import {
  clearScanState,
  getScanState,
  getSettings,
  saveScanState,
  saveSettings,
} from "./src/storage.js";
import { resetMessages, resetSelection, restoreMessages, state } from "./src/state.js";

const $ = (id) => document.getElementById(id);
const connectView = $("connectView");
const scanView = $("scanView");
const senderSummaries = new Map();
let currentSettings;
let currentAccountEmail = "";
let senderSearchQuery = "";
let activeCategory = "ALL";

const CATEGORY_HINTS = {
  ALL: "hintAll",
  CLEAN: "hintClean",
  REVIEW: "hintReview",
  KEEP: "hintKeep",
};

function showError(error) {
  $("error").textContent = error.message || String(error);
  $("error").hidden = false;
}

function clearError() {
  $("error").hidden = true;
}

function setConnected(connected) {
  state.connected = connected;
  connectView.hidden = connected;
  scanView.hidden = !connected;
}

function resetAccountState() {
  resetMessages();
  senderSummaries.clear();
  currentAccountEmail = "";
  $("results").hidden = true;
  $("lastScanBadge").hidden = true;
  $("accountEmail").textContent = t("readyToScan");
  $("statusTitle").textContent = t("seeWhatCanGo");
  $("statusText").textContent = t("scanDescription");
  setConnected(false);
}

async function loadProfile() {
  try {
    const profile = await getProfile();
    const email = profile.emailAddress || "";
    $("accountEmail").textContent = email || t("gmailConnected");
    return email;
  } catch {
    if (!currentAccountEmail) $("accountEmail").textContent = t("gmailConnected");
    return "";
  }
}

async function persistScanState() {
  if (!state.messages.length && !state.lastScanAt) return;
  try {
    await saveScanState({
      accountEmail: currentAccountEmail,
      messages: state.messages,
      selectedIds: [...state.selectedIds],
      lastScanAt: state.lastScanAt?.toISOString() || null,
      senderSummaries: Object.fromEntries(senderSummaries),
    });
  } catch (error) {
    console.warn("Could not save scan state", error);
  }
}

function restoreScanState(savedScan) {
  restoreMessages(savedScan);
  senderSummaries.clear();
  Object.entries(savedScan.senderSummaries || {}).forEach(([email, summary]) => {
    if (summary?.messageIds && summary?.references) senderSummaries.set(email, summary);
  });
}

function setProgress(completed, total) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  $("progressBar").style.width = percent + "%";
  $("progressText").textContent = t("readingMessage", { completed, total });
  $("progressPercent").textContent = percent + "%";
}

function updateTrashButton() {
  const count = state.selectedIds.size;
  $("trashButton").disabled = count === 0;
  $("trashButton").querySelector("span").textContent = count
    ? t("moveSelectedCount", { count })
    : t("moveSelected");
  $("selectionSummary").textContent = count
    ? t("selectedCount", { count })
    : t("noConfirmation");
}

function updateSelectionButtons() {
  const candidates = state.messages.filter((message) => message.category !== "KEEP");
  const allSelected = candidates.length > 0
    && candidates.every((message) => state.selectedIds.has(message.id));
  $("selectAllButton").textContent = allSelected ? t("clearSuggested") : t("selectSuggested");
  $("selectAllButton").disabled = candidates.length === 0;
  $("selectCleanButton").disabled = !state.messages.some((message) => message.category === "CLEAN");
}

async function preloadFrequentSenderIds(messages) {
  const emails = frequentSenderEmails(messages);

  for (let index = 0; index < emails.length; index += 4) {
    const batch = emails.slice(index, index + 4);
    await Promise.all(batch.map(async (email) => {
      try {
        senderSummaries.set(email, await getInboxSenderSummary(email));
      } catch {
        // The row falls back to the count found in this scan.
      }
    }));
  }
}

function renderResults() {
  const counts = countByCategory(state.messages);
  $("keepCount").textContent = counts.KEEP;
  $("reviewCount").textContent = counts.REVIEW;
  $("cleanCount").textContent = counts.CLEAN;
  $("allFilterCount").textContent = state.messages.length;
  $("keepFilterCount").textContent = counts.KEEP;
  $("reviewFilterCount").textContent = counts.REVIEW;
  $("cleanFilterCount").textContent = counts.CLEAN;
  document.querySelectorAll(".category-filter").forEach((button) => {
    const selected = button.dataset.category === activeCategory;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  const filterHint = $("filterHint");
  filterHint.className = "filter-hint" + (activeCategory === "ALL" ? "" : " " + activeCategory.toLowerCase());
  filterHint.lastElementChild.textContent = t(CATEGORY_HINTS[activeCategory]);
  $("results").hidden = false;
  $("statusTitle").textContent = t("messagesReviewed", { count: state.messages.length });
  $("lastScanBadge").hidden = false;
  const list = $("candidateList");
  list.replaceChildren();
  const filteredMessages = activeCategory === "ALL"
    ? state.messages
    : state.messages.filter((message) => message.category === activeCategory);
  const sortedGroups = groupMessagesBySender(filteredMessages);
  const visibleGroups = groupMessagesBySender(filteredMessages, senderSearchQuery);
  $("candidateSummary").textContent = senderSearchQuery
    ? t("senderSummarySearch", { visible: visibleGroups.length, total: sortedGroups.length })
    : t("senderSummary", { senders: sortedGroups.length, messages: filteredMessages.length });
  visibleGroups.forEach(({ email, messages }) => {
    list.append(createSenderRow({
      email,
      messages,
      activeCategory,
      selectedIds: state.selectedIds,
      senderSummaries,
      onError: showError,
      onSelectionStart: clearError,
      onStatusChange: (status) => {
        $("statusText").textContent = status;
      },
      onSelectionChange: async () => {
        renderResults();
        await persistScanState();
      },
    }));
  });

  if (!list.children.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.textContent = senderSearchQuery ? "⌕" : activeCategory === "KEEP" ? "✓" : "—";
    const title = document.createElement("strong");
    title.textContent = senderSearchQuery
      ? t("noMatchingSender")
      : activeCategory === "ALL" ? t("noMessagesScan") : t("noCategoryMessages", { category: t(activeCategory.toLowerCase()) });
    const detail = document.createElement("p");
    detail.textContent = senderSearchQuery
      ? t("tryDifferentSender")
      : t("categoryEmpty");
    empty.append(icon, title, detail);
    list.append(empty);
  }
  updateSelectionButtons();
  updateTrashButton();
}

async function scan() {
  clearError();
  state.scanning = true;
  $("scanButton").disabled = true;
  $("scanButton").querySelector("span").textContent = t("scanning");
  $("statusTitle").textContent = t("readingInbox");
  $("statusText").textContent = t("classifyingLocal");
  $("progressArea").hidden = false;
  $("progressBar").style.width = "0%";
  $("progressText").textContent = t("preparingScan");
  $("progressPercent").textContent = "0%";

  try {
    const scanLimit = Number($("scanLimit").value);
    currentSettings = { ...currentSettings, scanLimit };
    await saveSettings(currentSettings);
    const messages = await listInboxMessages(scanLimit, setProgress);
    state.messages = classifyMessages(messages, currentSettings);
    senderSummaries.clear();
    $("statusText").textContent = t("groupingSenders");
    await preloadFrequentSenderIds(state.messages);
    state.lastScanAt = new Date();
    resetSelection();
    $("statusText").textContent = t("scanComplete");
    $("lastScanBadge").textContent = t("justNow");
    renderResults();
    await persistScanState();
  } catch (error) {
    showError(error);
    $("statusTitle").textContent = t("scanFailed");
    $("statusText").textContent = t("nothingChanged");
  } finally {
    state.scanning = false;
    $("scanButton").disabled = false;
    $("scanButton").querySelector("span").textContent = t("scanAgain");
    $("progressArea").hidden = true;
  }
}

$("connectButton").addEventListener("click", async () => {
  clearError();
  $("connectButton").disabled = true;
  $("connectButton").querySelector("span").textContent = t("connecting");
  try {
    await connect();
    setConnected(true);
    currentAccountEmail = await loadProfile();
  } catch (error) {
    showError(error);
  } finally {
    $("connectButton").disabled = false;
    $("connectButton").querySelector("span").textContent = t("connectGmail");
  }
});

$("disconnectButton").addEventListener("click", async () => {
  if (!confirm(t("confirmDisconnect"))) return;
  clearError();
  $("disconnectButton").disabled = true;
  $("disconnectButton").textContent = t("disconnecting");
  try {
    await disconnectGmail();
    await clearScanState();
    resetAccountState();
  } catch (error) {
    showError(error);
    $("disconnectButton").disabled = false;
    $("disconnectButton").textContent = t("disconnect");
  }
});

$("scanButton").addEventListener("click", scan);

$("scanLimit").addEventListener("change", async () => {
  currentSettings = { ...currentSettings, scanLimit: Number($("scanLimit").value) };
  await saveSettings(currentSettings);
});

$("senderSearch").addEventListener("input", () => {
  senderSearchQuery = $("senderSearch").value.trim().toLocaleLowerCase();
  $("clearSearchButton").hidden = !senderSearchQuery;
  renderResults();
});

$("clearSearchButton").addEventListener("click", () => {
  $("senderSearch").value = "";
  senderSearchQuery = "";
  $("clearSearchButton").hidden = true;
  renderResults();
  $("senderSearch").focus();
});

$("categoryFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderResults();
});

$("selectCleanButton").addEventListener("click", async () => {
  state.messages
    .filter((message) => message.category === "CLEAN")
    .forEach((message) => state.selectedIds.add(message.id));
  renderResults();
  await persistScanState();
});

$("selectAllButton").addEventListener("click", async () => {
  const candidates = state.messages.filter((message) => message.category !== "KEEP");
  const allSelected = candidates.length > 0
    && candidates.every((message) => state.selectedIds.has(message.id));
  if (allSelected) candidates.forEach((message) => state.selectedIds.delete(message.id));
  else candidates.forEach((message) => state.selectedIds.add(message.id));
  renderResults();
  await persistScanState();
});

$("trashButton").addEventListener("click", async () => {
  const count = state.selectedIds.size;
  const conversationCount = selectedConversationCount(
    state.messages,
    senderSummaries,
    state.selectedIds,
  );
  const conversationNote = conversationCount > 0 && conversationCount < count
    ? "\n\n" + t("conversationNote", { count: conversationCount })
    : "";
  if (!count || !confirm(t("confirmTrash", { count }) + conversationNote)) return;
  clearError();
  $("trashButton").disabled = true;
  try {
    const trashedIds = new Set(state.selectedIds);
    await trashMessages([...trashedIds]);
    state.messages = state.messages.filter((message) => !trashedIds.has(message.id));
    removeMessagesFromSummaries(senderSummaries, trashedIds);
    resetSelection();
    renderResults();
    $("statusText").textContent = conversationCount > 0 && conversationCount < count
      ? t("movedTrashConversations", { count, conversations: conversationCount })
      : t("movedTrash", { count });
    await persistScanState();
  } catch (error) {
    showError(error);
    updateTrashButton();
  }
});

async function initialize() {
  currentSettings = await getSettings();
  await initI18n(currentSettings.language);
  $("scanLimit").value = String(currentSettings.scanLimit);
  const connected = await hasCachedToken();
  setConnected(connected);
  if (connected) {
    const savedScan = await getScanState();
    if (savedScan?.accountEmail) {
      currentAccountEmail = savedScan.accountEmail;
      $("accountEmail").textContent = currentAccountEmail;
    }
    if (savedScan && Array.isArray(savedScan.messages) && savedScan.messages.length) {
      restoreScanState(savedScan);
      $("statusText").textContent = t("restoredScan");
      $("lastScanBadge").textContent = t("savedScan");
      renderResults();
    }

    const profileEmail = await loadProfile();
    if (profileEmail && savedScan?.accountEmail
      && profileEmail.toLowerCase() !== savedScan.accountEmail.toLowerCase()) {
      resetMessages();
      senderSummaries.clear();
      $("results").hidden = true;
      $("lastScanBadge").hidden = true;
      $("statusTitle").textContent = t("seeWhatCanGo");
      $("statusText").textContent = t("differentAccount");
    }
    if (profileEmail) currentAccountEmail = profileEmail;
  }
}

initialize().catch(showError);
