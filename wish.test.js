"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  nextWishNames,
  nextWishTreeName,
  usedBranchNames,
  buildPrompt,
  slugifyWish,
  promptForOmo,
  splitUtf8,
  askPaneArgs,
  WISH_FILE_NAME,
  isWishSkillInstalled,
  settingsHaveWishSkill,
  listMentionsWishSkill,
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

test("long wishes become a short /wish that points at WISH.md", () => {
  const short = "/wish fix login and commit and make pr";
  assert.equal(promptForOmo(short), short);
  const long = `/wish ${"아주 긴 소원 ".repeat(200)} and commit and make pr`;
  assert.equal(
    promptForOmo(long),
    `/wish Follow ${WISH_FILE_NAME} in this worktree. and commit and make pr`,
  );
  assert.ok(splitUtf8(long, 700).every((chunk) => Buffer.byteLength(chunk) <= 700));
  assert.equal(splitUtf8(long, 700).join(""), long);
});

test("ask popup does not pass --workspace (stock Herdr rejects it)", () => {
  const args = askPaneArgs("workspace_3");
  assert.equal(args.includes("--workspace"), false);
  assert.ok(args.includes("--env"));
  assert.ok(args.includes("WISH_WORKSPACE_ID=workspace_3"));
  assert.ok(args.includes("popup"));
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

test("detects omo-wish in settings and list output", () => {
  assert.equal(
    settingsHaveWishSkill({
      packages: ["https://github.com/DevNewbie1826/omo-wish"],
    }),
    true,
  );
  assert.equal(settingsHaveWishSkill({ packages: ["something-else"] }), false);
  assert.equal(
    listMentionsWishSkill("User packages:\n  https://github.com/DevNewbie1826/omo-wish"),
    true,
  );
  assert.equal(listMentionsWishSkill("User packages:\n  (none)"), false);
});

test("treats /wish as installed only when settings and checkout agree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-wish-"));
  const agent = path.join(root, "agent");
  const checkout = path.join(agent, "git", "github.com", "DevNewbie1826", "omo-wish");
  fs.mkdirSync(path.join(checkout, "prompts"), { recursive: true });
  fs.writeFileSync(path.join(checkout, "package.json"), "{}");
  fs.writeFileSync(
    path.join(agent, "settings.json"),
    JSON.stringify({ packages: ["https://github.com/DevNewbie1826/omo-wish"] }),
  );
  assert.equal(
    isWishSkillInstalled({ home: root, agentDir: agent, cwd: "", listText: "" }),
    true,
  );
  fs.rmSync(path.join(agent, "settings.json"));
  assert.equal(
    isWishSkillInstalled({ home: root, agentDir: agent, cwd: "", listText: "" }),
    false,
  );
  fs.rmSync(root, { recursive: true, force: true });
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
