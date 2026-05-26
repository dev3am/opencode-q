import { test, expect, afterEach } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import { instancesDir, legacyProjectsDir, isExcludedBaseDir, PENDING_TIMEOUT_MS, STALE_CLEANUP_MS, SWEEP_MS } from "../src/constants"

afterEach(() => { delete process.env.OPENCODE_Q_HOME })

test("instancesDir and legacyProjectsDir live under OPENCODE_Q_HOME", () => {
  process.env.OPENCODE_Q_HOME = "/tmp/oqh"
  expect(instancesDir()).toBe(join("/tmp/oqh", "instances"))
  expect(legacyProjectsDir()).toBe(join("/tmp/oqh", "projects"))
})

test("isExcludedBaseDir excludes homedir and filesystem root, allows real projects", () => {
  expect(isExcludedBaseDir(homedir())).toBe(true)
  expect(isExcludedBaseDir("/")).toBe(true)
  expect(isExcludedBaseDir(join(homedir(), "Desktop", "proj"))).toBe(false)
})

test("timeout constants have sane values", () => {
  expect(PENDING_TIMEOUT_MS).toBe(20_000)
  expect(STALE_CLEANUP_MS).toBe(300_000)
  expect(SWEEP_MS).toBe(2_000)
})
