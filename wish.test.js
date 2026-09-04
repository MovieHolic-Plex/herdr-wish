"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { nextWishNames, usedBranchNames, buildPrompt } = require("./wish.js");

test("picks unused wish-1..wish-N", () => {
  const used = new Set(["main"]);
  assert.deepEqual(nextWishNames(used, "wish", 3), [
    "wish-1",
    "wish-2",
    "wish-3",
  ]);
});

test("skips names that already exist", () => {
  const used = new Set(["wish-1", "wish-2", "main"]);
  assert.deepEqual(nextWishNames(used, "wish", 2), ["wish-3", "wish-4"]);
});

test("appends commit-and-PR instruction once", () => {
  assert.equal(
    buildPrompt("fix login"),
    "fix login and commit and make pr",
  );
  assert.equal(
    buildPrompt("fix login and commit and make pr"),
    "fix login and commit and make pr",
  );
});

test("collects branch and label names from worktree list", () => {
  const used = usedBranchNames({
    worktrees: [
      { branch: "main", label: "europe-travel-safe" },
      { branch: "wish-1", label: "wish-1" },
    ],
  });
  assert.equal(used.has("main"), true);
  assert.equal(used.has("wish-1"), true);
  assert.equal(used.has("europe-travel-safe"), true);
});
