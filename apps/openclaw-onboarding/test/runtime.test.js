import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dispatch } from "../src/api/router.js";
import { db } from "../src/store/memory-repo.js";
import { LocalApiClient } from "../src/runtime/api-client.js";
import { FileStateStore } from "../src/runtime/state-store.js";
import { SkillLoader } from "../src/runtime/skill-loader.js";
import { MockFeishuSender } from "../src/runtime/mock-feishu-sender.js";
import { OpenClawRuntime } from "../src/runtime/openclaw-runtime.js";
import { DEFAULT_SKILL_PATH } from "../src/runtime-config.js";

async function makeRuntime() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "onboarding-runtime-"));
  const stateStore = new FileStateStore(path.join(dir, "state.json"));
  const apiClient = new LocalApiClient({
    dispatch,
    hostToken: "feishu-user:u_123",
    baseUrl: "http://local.test",
  });
  const sender = new MockFeishuSender();
  const runtime = new OpenClawRuntime({
    userId: "u_123",
    openClawId: "oc_123",
    apiClient,
    stateStore,
    skillLoader: new SkillLoader({ skillPath: DEFAULT_SKILL_PATH }),
    feishuSender: sender,
    baseUrl: "http://local.test",
  });
  return { runtime, sender, dir };
}

test.beforeEach(() => {
  db.reset();
});

test("runtime initializes token -> redeem -> status", async () => {
  const { runtime, dir } = await makeRuntime();
  const state = await runtime.initialize();
  assert.equal(state.redeemed, true);
  assert.ok(state.onboarding_token);
  assert.equal(state.status_cache.service_active, true);
  await fs.rm(dir, { recursive: true, force: true });
});

test("runtime can proactively reach user", async () => {
  const { runtime, sender, dir } = await makeRuntime();
  await runtime.initialize();
  await db.addLog({ type: "success", userId: "u_123", openClawId: "oc_123", scene: "draft" });
  const result = await runtime.maybeProactiveReach();
  assert.equal(result.sent, true);
  assert.equal(sender.messages.length, 1);
  assert.match(sender.messages[0].content, /提炼重点|飞书消息|起草/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("runtime stops onboarding behavior when service becomes inactive", async () => {
  const { runtime, dir } = await makeRuntime();
  let state = await runtime.initialize();
  state.status_cache.service_active = false;
  await runtime.saveState(state);
  const result = await runtime.handleUserMessage({ text: "hello" });
  assert.equal(result.onboardingActive, false);
  await fs.rm(dir, { recursive: true, force: true });
});
