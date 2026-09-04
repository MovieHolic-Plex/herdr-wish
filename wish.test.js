"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  nextWishNames,
  nextWishTreeName,
  usedBranchNames,
  buildPrompt,
  slugifyWish,
} = require("./wish.js");

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

test("forces the omo /wish skill and appends commit-and-PR once", () => {
  assert.equal(
    buildPrompt("fix login"),
    "/wish fix login and commit and make pr",
  );
  assert.equal(
    buildPrompt("/wish fix login"),
    "/wish fix login and commit and make pr",
  );
  assert.equal(
    buildPrompt("fix login and commit and make pr"),
    "/wish fix login and commit and make pr",
  );
  assert.equal(
    buildPrompt("/wish fix login and commit and make pr"),
    "/wish fix login and commit and make pr",
  );
  assert.equal(buildPrompt("/wish"), "/wish");
});

test("names a wish worktree from the prompt slug", () => {
  assert.equal(slugifyWish("Fix the login bug!"), "fix-the-login-bug");
  assert.equal(slugifyWish("로그인 고치기"), "");
  assert.equal(
    nextWishTreeName(new Set(["main"]), "fix the login bug"),
    "wish-fix-the-login-bug",
  );
  assert.equal(
    nextWishTreeName(new Set(["wish-fix-the-login-bug"]), "fix the login bug"),
    "wish-fix-the-login-bug-2",
  );
  assert.equal(nextWishTreeName(new Set(["wish-1", "main"]), "로그인 고치기"), "wish-2");
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
