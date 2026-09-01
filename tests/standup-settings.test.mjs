import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSettingsSearch,
  settingsToSearch,
} from "../lib/standup-settings.ts";

test("round-trips names that need encoding", () => {
  const settings = {
    version: 1,
    users: ["Алексей 🚀", "Sam & Jo", "a=b+c", "日本語 名前", "🎉👨‍👩‍👧‍👦"],
    durationMinutes: 1.5,
  };

  const search = settingsToSearch(settings);

  assert.doesNotMatch(search, /[^\x20-\x7e]/, "the link must stay ASCII safe");
  assert.deepEqual(parseSettingsSearch(search), settings);
});

test("keeps the participant order from the link", () => {
  const search = "?u=Alex&u=Sam&u=Jordan&min=2";

  assert.deepEqual(parseSettingsSearch(search)?.users, [
    "Alex",
    "Sam",
    "Jordan",
  ]);
});

test("falls back to the default duration for a missing or broken value", () => {
  assert.equal(parseSettingsSearch("?u=Alex")?.durationMinutes, 2);
  assert.equal(parseSettingsSearch("?u=Alex&min=nope")?.durationMinutes, 2);
  assert.equal(parseSettingsSearch("?u=Alex&min=-3")?.durationMinutes, 2);
  assert.equal(parseSettingsSearch("?u=Alex&min=0.25")?.durationMinutes, 0.25);
});

test("ignores links without participants", () => {
  assert.equal(parseSettingsSearch(""), null);
  assert.equal(parseSettingsSearch("?min=3"), null);
  assert.equal(parseSettingsSearch("?u=%20%20"), null);
  assert.equal(settingsToSearch(null), "");
});

test("survives a hand-edited link with a broken escape", () => {
  assert.deepEqual(parseSettingsSearch("?u=%E0%A4%A&u=Sam")?.users.length, 2);
});
