import assert from "node:assert/strict";
import test from "node:test";

import { CATEGORIES, classifyMessage } from "../src/classifier.js";

const SETTINGS = Object.freeze({
  reviewDays: 30,
  keepSenders: [],
  cleanPromotions: true,
  cleanSocial: true,
});

function createMessage({
  id = "message-1",
  threadId = "thread-1",
  from = "Updates <updates@example.com>",
  subject = "Account update",
  date = new Date().toUTCString(),
  snippet = "",
} = {}) {
  return {
    id,
    threadId,
    snippet,
    payload: {
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: subject },
        { name: "Date", value: date },
      ],
    },
  };
}

test("trusted senders always remain in KEEP", () => {
  const message = createMessage({
    from: "Deals <offers@example.com>",
    subject: "Huge sale and discount",
    date: "2020-01-01T00:00:00Z",
  });
  const result = classifyMessage(message, {
    ...SETTINGS,
    keepSenders: ["offers@example.com"],
  });

  assert.equal(result.category, CATEGORIES.KEEP);
  assert.equal(result.score, -5);
  assert.deepEqual(result.reasons, ["trusted sender"]);
});

test("promotion language plus age becomes CLEAN", () => {
  const result = classifyMessage(createMessage({
    from: "Shop <hello@example.com>",
    subject: "Weekend sale",
    date: "2020-01-01T00:00:00Z",
  }), SETTINGS);

  assert.equal(result.category, CATEGORIES.CLEAN);
  assert.equal(result.score, 4);
});

test("social notifications require review", () => {
  const result = classifyMessage(createMessage({
    from: "Community <hello@example.com>",
    subject: "Someone mentioned you",
  }), SETTINGS);

  assert.equal(result.category, CATEGORIES.REVIEW);
  assert.equal(result.score, 3);
});

test("an automated sender alone stays in KEEP", () => {
  const result = classifyMessage(createMessage({
    from: "noreply@example.com",
  }), SETTINGS);

  assert.equal(result.category, CATEGORIES.KEEP);
  assert.equal(result.score, 1);
});

test("invalid dates do not make a message old", () => {
  const result = classifyMessage(createMessage({ date: "not-a-date" }), SETTINGS);

  assert.equal(result.ageDays, 0);
  assert.equal(result.category, CATEGORIES.KEEP);
});
