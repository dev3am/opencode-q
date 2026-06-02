import { homedir } from "node:os";
import { join, parse, resolve } from "node:path";

export const STORAGE_DIR = ".opencode";
export const QUEUE_PREFIX = "queue-";
export const QUEUE_EXT = ".json";
export const ID_LENGTH = 8;
export const ID_CHARSET = "0123456789abcdef";

export const DEFAULT_PORT = 4321;
export const HEALTH_SIGNATURE = "opencode-q";
export const VERSION = "1.1.4";

export const POLL_PENDING_MS = 750;
export const HEARTBEAT_MS = 10_000;
export const LIVENESS_TIMEOUT_MS = 30_000;
export const REELECTION_MS = 5_000;

export function globalDir(): string {
	return (
		process.env.OPENCODE_Q_HOME ||
		join(homedir(), ".config", "opencode", "opencode-q")
	);
}
export function projectsDir(): string {
	return join(globalDir(), "projects");
}

export const PENDING_TIMEOUT_MS = 20_000;
export const STALE_CLEANUP_MS = 300_000;
export const SWEEP_MS = 2_000;

export function instancesDir(): string {
	return join(globalDir(), "instances");
}
// Points to the old per-baseDir sha1 registry path; used only by cleanupLegacyProjectsDir to remove it.
export function legacyProjectsDir(): string {
	return join(globalDir(), "projects");
}
export function isExcludedBaseDir(baseDir: string): boolean {
	const r = resolve(baseDir);
	return r === resolve(homedir()) || r === parse(r).root;
}
