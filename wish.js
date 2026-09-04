"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_COUNT = 10;
const DEFAULT_COMMAND = "omo";
const DEFAULT_PREFIX = "omo";
const PROMPT_SUFFIX = "and commit and make pr";

function main() {
  const mode = process.argv[2] || "spawn";
  if (mode === "cast") {
    castWish();
    return;
  }
  spawnOmo10();
}

function spawnOmo10() {
  const herdr = bin();
  const settings = loadSettings();
  const workspaceId = resolveWorkspaceId();
  if (!workspaceId) {
    fail("workspace_id is required (right-click a git space, or focus one)");
  }

  const listed = herdrJson(herdr, [
    "worktree",
    "list",
    "--workspace",
    workspaceId,
  ]);
  const createFrom = listed?.source?.source_workspace_id || workspaceId;
  const used = usedBranchNames(listed);
  const names = nextWishNames(used, settings.prefix, settings.count);

  const created = [];
  for (const [index, name] of names.entries()) {
    const focus = index === names.length - 1;
    const createdTree = createWorktree(herdr, createFrom, name, focus);
    const paneId = createdTree?.root_pane?.pane_id;
    if (!paneId) {
      fail(`worktree create ${name} returned no root pane`);
    }
    waitForPane(herdr, paneId);
    runInPane(herdr, paneId, settings.command);
    created.push({
      name,
      workspace_id: createdTree.workspace?.workspace_id,
      pane_id: paneId,
    });
    process.stdout.write(`omo-10: ${name} -> ${paneId}\n`);
  }

  process.stdout.write(
    `omo-10: started ${created.length} worktrees with ${settings.command}\n`,
  );
}

function castWish() {
  const herdr = bin();
  const settings = loadSettings();
  const workspaceId = resolveWorkspaceId();
  const wish = resolveWishText();
  if (!workspaceId) {
    fail("workspace_id is required");
  }
  if (!wish) {
    fail("wish text is empty");
  }
  const prompt = buildPrompt(wish);
  const paneId = ensureOmoPane(herdr, workspaceId, settings.command);
  sendPrompt(herdr, paneId, prompt);
  herdrJson(herdr, ["pane", "focus", paneId], { ignoreError: true });
  process.stdout.write(`wish: sent to ${paneId}\n${prompt}\n`);
}

function resolveWishText() {
  if (process.env.WISH_TEXT) {
    return process.env.WISH_TEXT.trim();
  }
  try {
    const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || "{}");
    return String(context.selected_text || "").trim();
  } catch {
    return "";
  }
}

function buildPrompt(wish) {
  const text = String(wish || "").trim();
  if (!text) {
    return "";
  }
  if (text.toLowerCase().endsWith(PROMPT_SUFFIX)) {
    return text;
  }
  return `${text} ${PROMPT_SUFFIX}`;
}

function ensureOmoPane(herdr, workspaceId, command) {
  const existing = findOmoPane(herdr, workspaceId);
  if (existing) {
    return existing;
  }
  const paneId = resolveStartPaneId(herdr, workspaceId);
  if (!paneId) {
    fail(`no pane in workspace ${workspaceId}`);
  }
  waitForPane(herdr, paneId);
  runInPane(herdr, paneId, command);
  waitForOmo(herdr, paneId, 30000);
  return paneId;
}

function resolveStartPaneId(herdr, workspaceId) {
  const focused = resolveFocusedPaneId();
  const panes = listPanes(herdr, workspaceId);
  if (focused && panes.some((pane) => pane.pane_id === focused)) {
    return focused;
  }
  return panes[0]?.pane_id || focused || "";
}

function resolveFocusedPaneId() {
  if (process.env.HERDR_PANE_ID) {
    return process.env.HERDR_PANE_ID;
  }
  try {
    const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || "{}");
    return context.focused_pane_id || "";
  } catch {
    return "";
  }
}

function findOmoPane(herdr, workspaceId) {
  return listPanes(herdr, workspaceId).find(isOmoPane)?.pane_id || "";
}

function listPanes(herdr, workspaceId) {
  const listed = herdrJson(herdr, ["pane", "list", "--workspace", workspaceId], {
    ignoreError: true,
  });
  return listed?.panes || [];
}

function isOmoPane(pane) {
  return (
    pane?.agent === "omo" ||
    /omo/i.test(pane?.terminal_title || "") ||
    /omo/i.test(pane?.terminal_title_stripped || "")
  );
}

function waitForOmo(herdr, paneId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = herdrJson(herdr, ["pane", "get", paneId], { ignoreError: true });
    const pane = result?.pane || result;
    if (isOmoPane(pane)) {
      return true;
    }
    sleep(400);
  }
  return false;
}

function sendPrompt(herdr, paneId, text) {
  const prompted = herdrJson(herdr, ["agent", "prompt", paneId, text], {
    ignoreError: true,
  });
  if (prompted) {
    return;
  }
  herdrJson(herdr, ["pane", "send-text", paneId, text]);
  herdrJson(herdr, ["pane", "send-keys", paneId, "enter"]);
}

function loadSettings() {
  const fromFile = readConfigFile();
  return {
    count: positiveInt(
      process.env.WISH_COUNT || fromFile.count,
      DEFAULT_COUNT,
    ),
    command: String(
      process.env.WISH_COMMAND || fromFile.command || DEFAULT_COMMAND,
    ).trim() || DEFAULT_COMMAND,
    prefix: String(
      process.env.WISH_PREFIX || fromFile.branchPrefix || DEFAULT_PREFIX,
    ).trim() || DEFAULT_PREFIX,
  };
}

function readConfigFile() {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  if (!dir) {
    return {};
  }
  const file = path.join(dir, "config.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function resolveWorkspaceId() {
  if (process.env.HERDR_WORKSPACE_ID) {
    return process.env.HERDR_WORKSPACE_ID;
  }
  try {
    const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || "{}");
    return context.workspace_id || "";
  } catch {
    return "";
  }
}

function usedBranchNames(listed) {
  const names = new Set();
  for (const tree of listed?.worktrees || []) {
    if (tree.branch) {
      names.add(tree.branch);
    }
    if (tree.label) {
      names.add(tree.label);
    }
  }
  return names;
}

function nextWishNames(used, prefix, count) {
  const names = [];
  let n = 1;
  while (names.length < count) {
    const name = `${prefix}-${n}`;
    n += 1;
    if (!used.has(name)) {
      names.push(name);
      used.add(name);
    }
  }
  return names;
}

function createWorktree(herdr, workspaceId, name, focus) {
  return herdrJson(herdr, [
    "worktree",
    "create",
    "--workspace",
    workspaceId,
    "--branch",
    name,
    "--base",
    "HEAD",
    "--label",
    name,
    focus ? "--focus" : "--no-focus",
  ]);
}

function waitForPane(herdr, paneId) {
  herdrJson(herdr, [
    "pane",
    "wait-output",
    paneId,
    "--regex",
    ".",
    "--timeout",
    "20000",
  ], { ignoreError: true });
}

function runInPane(herdr, paneId, command) {
  herdrJson(herdr, ["pane", "run", paneId, command]);
}

function herdrJson(herdr, args, options = {}) {
  const result = spawnSync(herdr, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  if (!out.trim()) {
    if (result.status === 0) {
      return { type: "ok" };
    }
    if (options.ignoreError) {
      return null;
    }
    fail(`herdr ${args.join(" ")} failed with exit ${result.status}`);
  }
  const jsonStart = out.indexOf("{");
  if (jsonStart === -1) {
    if (options.ignoreError) {
      return null;
    }
    fail(`herdr ${args.join(" ")} produced no JSON\n${out.slice(0, 800)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(out.slice(jsonStart));
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    fail(`herdr ${args.join(" ")} returned invalid JSON: ${error.message}`);
  }
  if (parsed.error) {
    if (options.ignoreError) {
      return null;
    }
    fail(parsed.error.message || JSON.stringify(parsed.error));
  }
  return parsed.result;
}

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      /* wait */
    }
  }
}

function bin() {
  return process.env.HERDR_BIN_PATH || "herdr";
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fail(message) {
  process.stderr.write(`wish: ${message}\n`);
  process.exit(1);
}

module.exports = { nextWishNames, usedBranchNames, buildPrompt };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error));
  }
}
