import { getInboxSenderSummary } from "./gmail-client.js";
import { t } from "./i18n.js";
import {
  countByCategory,
  countThreads,
  dominantCategory,
  findUnsubscribeUrl,
  senderLabel,
} from "./message-utils.js";

const DISPLAYED_CATEGORIES = Object.freeze(["CLEAN", "REVIEW", "KEEP"]);

function createBadges(messages, categoryCounts) {
  const badges = document.createElement("span");
  badges.className = "sender-badges";
  const values = [];

  if (messages.some((message) => message.promotion)) {
    values.push([t("promotion"), "promotion"]);
  }
  if (messages.some((message) => message.social)) {
    values.push([t("social"), "social"]);
  }
  if (messages.some((message) => message.automated)) {
    values.push([t("automated"), "automated"]);
  }

  for (const category of DISPLAYED_CATEGORIES) {
    const count = categoryCounts[category];
    if (!count) continue;
    const label = t(category.toLocaleLowerCase()) + (count > 1 ? ` ${count}` : "");
    values.push([label, category.toLocaleLowerCase()]);
  }

  for (const [label, type] of values) {
    const badge = document.createElement("small");
    badge.className = `sender-badge ${type}`;
    badge.textContent = label;
    badges.append(badge);
  }

  return badges;
}

function createSenderIdentity(email, messages) {
  const firstMessage = messages[0];
  const label = senderLabel(firstMessage.from);

  const avatar = document.createElement("span");
  avatar.className = "sender-avatar";
  avatar.textContent = (label[0] || "@").toLocaleUpperCase();

  const copy = document.createElement("span");
  copy.className = "sender-row-copy";

  const name = document.createElement("strong");
  name.textContent = label;

  const detail = document.createElement("span");
  detail.textContent = email || firstMessage.from;

  copy.append(name, detail, createBadges(messages, countByCategory(messages)));
  return { avatar, copy, label };
}

function createUnsubscribeButton(messages, onError) {
  const url = findUnsubscribeUrl(messages);
  if (!url) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "unsubscribe-button";
  button.textContent = t("unsubscribe");
  button.title = t("openUnsubscribe");
  button.addEventListener("click", async () => {
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      onError(error);
    }
  });
  return button;
}

function fallbackSummary(messages) {
  return {
    messageIds: messages.map((message) => message.id),
    threadCount: countThreads(messages),
    references: messages,
  };
}

export function createSenderRow({
  email,
  messages,
  activeCategory,
  selectedIds,
  senderSummaries,
  onError,
  onSelectionStart,
  onSelectionChange,
  onStatusChange,
}) {
  const row = document.createElement("div");
  row.className = `sender-row sender-row-${dominantCategory(messages).toLocaleLowerCase()}`;

  const selectsWholeSender = activeCategory === "ALL";
  const storedSummary = senderSummaries.get(email);
  const knownIds = selectsWholeSender && storedSummary?.messageIds
    ? storedSummary.messageIds
    : messages.map((message) => message.id);

  const checkboxWrap = document.createElement("label");
  checkboxWrap.className = "sender-checkbox";
  checkboxWrap.title = selectsWholeSender && email
    ? t("selectWholeSender", { email })
    : t("selectVisibleCategory", { category: t(activeCategory.toLocaleLowerCase()) });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = knownIds.length > 0 && knownIds.every((id) => selectedIds.has(id));
  checkboxWrap.append(checkbox, document.createElement("i"));
  row.classList.toggle("is-selected", checkbox.checked);

  const { avatar, copy, label } = createSenderIdentity(email, messages);
  const actions = document.createElement("span");
  actions.className = "sender-row-actions";

  const unsubscribeButton = createUnsubscribeButton(messages, onError);
  if (unsubscribeButton) actions.append(unsubscribeButton);

  const count = document.createElement("strong");
  count.className = "sender-count";
  count.textContent = String(knownIds.length || messages.length);
  count.title = selectsWholeSender && senderSummaries.has(email)
    ? t("inboxMessagesFromSender")
    : activeCategory === "ALL"
      ? t("messagesFoundScan")
      : t("categoryMessagesFoundScan", { category: t(activeCategory.toLocaleLowerCase()) });

  const scannedThreadCount = countThreads(messages);
  const threadCount = selectsWholeSender && storedSummary?.threadCount
    ? storedSummary.threadCount
    : scannedThreadCount;
  const countMeta = document.createElement("span");
  countMeta.className = "sender-count-meta";
  countMeta.textContent = threadCount && threadCount !== knownIds.length
    ? t("conversationCount", { count: threadCount })
    : t("emails");
  actions.append(count, countMeta);

  checkbox.addEventListener("change", async () => {
    onSelectionStart();
    const shouldSelect = checkbox.checked;
    checkbox.disabled = true;
    count.textContent = "…";

    try {
      const summary = selectsWholeSender && email
        ? senderSummaries.get(email) || await getInboxSenderSummary(email)
        : fallbackSummary(messages);

      if (selectsWholeSender && email) senderSummaries.set(email, summary);
      for (const id of summary.messageIds) {
        if (shouldSelect) selectedIds.add(id);
        else selectedIds.delete(id);
      }

      onStatusChange(shouldSelect
        ? t("selectedSender", {
            count: summary.messageIds.length,
            conversations: summary.threadCount,
            sender: email || label,
          })
        : t("clearedSender", { sender: email || label }));
      await onSelectionChange();
    } catch (error) {
      onError(error);
      checkbox.checked = !shouldSelect;
      checkbox.disabled = false;
      count.textContent = String(messages.length);
    }
  });

  row.append(checkboxWrap, avatar, copy, actions);
  return row;
}
