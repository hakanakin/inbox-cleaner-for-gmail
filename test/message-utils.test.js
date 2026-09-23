import assert from "node:assert/strict";
import test from "node:test";

import {
  countByCategory,
  findUnsubscribeUrl,
  groupMessagesBySender,
  removeMessagesFromSummaries,
  selectedConversationCount,
  senderEmail,
  senderLabel,
} from "../src/message-utils.js";

test("sender helpers support named and plain addresses", () => {
  assert.equal(senderLabel('"Example Team" <News@Example.com>'), "Example Team");
  assert.equal(senderEmail('"Example Team" <News@Example.com>'), "news@example.com");
  assert.equal(senderEmail("billing@example.org"), "billing@example.org");
  assert.equal(senderEmail("Invalid <not-an-address>"), "");
});

test("trashed messages are removed from cached sender summaries", () => {
  const summaries = new Map([
    ["sender@example.com", {
      messageIds: ["1", "2"],
      references: [
        { id: "1", threadId: "thread-a" },
        { id: "2", threadId: "thread-b" },
      ],
      threadIds: ["thread-a", "thread-b"],
      threadCount: 2,
      truncated: false,
    }],
  ]);

  removeMessagesFromSummaries(summaries, new Set(["1"]));
  assert.deepEqual(summaries.get("sender@example.com").messageIds, ["2"]);
  assert.equal(summaries.get("sender@example.com").threadCount, 1);

  removeMessagesFromSummaries(summaries, new Set(["2"]));
  assert.equal(summaries.size, 0);
});

test("unsubscribe links only allow HTTPS", () => {
  const messages = [{
    headers: {
      "list-unsubscribe": "<mailto:leave@example.com>, <https://example.com/unsubscribe>",
    },
  }];

  assert.equal(findUnsubscribeUrl(messages), "https://example.com/unsubscribe");
  assert.equal(findUnsubscribeUrl([{ headers: { "list-unsubscribe": "http://example.com" } }]), "");
});

test("sender groups are sorted by size and can be searched", () => {
  const messages = [
    { id: "1", from: "Beta <beta@example.com>" },
    { id: "2", from: "Alpha <alpha@example.com>" },
    { id: "3", from: "Beta <beta@example.com>" },
  ];

  const groups = groupMessagesBySender(messages);
  assert.equal(groups[0].email, "beta@example.com");
  assert.equal(groups[0].messages.length, 2);
  assert.equal(groupMessagesBySender(messages, "ALPHA")[0].email, "alpha@example.com");
});

test("category and conversation counts ignore unknown or duplicate values", () => {
  const messages = [
    { id: "1", threadId: "thread-a", category: "KEEP" },
    { id: "2", threadId: "thread-a", category: "CLEAN" },
    { id: "3", threadId: "thread-b", category: "UNKNOWN" },
  ];
  const summaries = new Map([
    ["sender@example.com", { references: [{ id: "4", threadId: "thread-c" }] }],
  ]);

  assert.deepEqual(countByCategory(messages), { KEEP: 1, REVIEW: 0, CLEAN: 1 });
  assert.equal(
    selectedConversationCount(messages, summaries, new Set(["1", "2", "4"])),
    2,
  );
});
