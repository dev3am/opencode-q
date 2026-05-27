import { existsSync, readFileSync } from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import { extname, join, resolve, sep } from "node:path";
import {
	HEALTH_SIGNATURE,
	PENDING_TIMEOUT_MS,
	STALE_CLEANUP_MS,
} from "./constants";
import * as R from "./registry";
import * as S from "./storage";

const VERSION = "1.1.0";

const MIME: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

function send(res: http.ServerResponse, status: number, body: any) {
	const data = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(data),
	});
	res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<any> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString();
			if (!raw.trim()) return resolve({});
			try {
				resolve(JSON.parse(raw));
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
	});
}

function buildState() {
	const now = Date.now();
	const groups = R.groupByBaseDir(R.readAllProjects(), now);
	const projects = groups
		.map((g) => ({
			baseDir: g.baseDir,
			online: g.online,
			sessions: g.sessions.map((s) => ({
				sessionId: s.sessionId,
				status: s.status,
				title: s.title ?? "",
				createdAt: s.createdAt ?? "",
				updatedAt: s.updatedAt ?? "",
				items: S.loadQueue(g.baseDir, s.sessionId).items,
			})),
		}))
		.filter(
			(p) =>
				p.online ||
				p.sessions.some((s) => s.items.some((i) => S.isLiveStatus(i.status))),
		);
	return { projects };
}

export function runSweep(now: number = Date.now()): void {
	R.cleanupLegacyProjectsDir();
	const records = R.readAllProjects();
	const groups = R.groupByBaseDir(records, now);
	for (const g of groups) {
		for (const s of g.sessions) {
			if (g.online)
				S.failTimedOutPending(g.baseDir, s.sessionId, PENDING_TIMEOUT_MS, now);
			else
				S.failAllInFlight(g.baseDir, s.sessionId, "인스턴스가 오프라인입니다");
		}
	}
	for (const rec of records) {
		if (R.isOnline(rec, now)) continue;
		const age = now - Date.parse(rec.heartbeat);
		if (age <= STALE_CLEANUP_MS) continue;
		const anyLive = rec.sessions.some((s) =>
			S.hasLiveItems(rec.baseDir, s.sessionId),
		);
		if (!anyLive) R.removeInstanceRecord(rec.instanceId);
	}
}

export function createRequestHandler(opts: { webDir?: string }) {
	const { webDir } = opts;

	function serveStatic(urlPath: string, res: http.ServerResponse): boolean {
		if (!webDir) return false;
		const safe = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
		const resolved = resolve(webDir, safe);
		if (
			!resolved.startsWith(resolve(webDir) + sep) &&
			resolved !== resolve(webDir)
		)
			return false;
		let file = resolved;
		if (!existsSync(file)) file = join(webDir, "index.html");
		if (!existsSync(file)) return false;
		const data = readFileSync(file);
		res.writeHead(200, {
			"Content-Type": MIME[extname(file)] || "application/octet-stream",
			"Content-Length": data.length,
		});
		res.end(data);
		return true;
	}

	return async function handler(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	) {
		try {
			const url = new URL(req.url || "/", "http://localhost");
			const p = url.pathname;

			if (p === "/health" && req.method === "GET")
				return send(res, 200, { app: HEALTH_SIGNATURE, version: VERSION });
			if (p === "/api/state" && req.method === "GET")
				return send(res, 200, buildState());

			let m = p.match(
				/^\/api\/projects\/([^/]+)\/sessions\/([^/]+)\/items\/([^/]+)\/(send|resend)$/,
			);
			if (m && req.method === "POST") {
				const [, b, s, id] = m;
				const baseDir = decodeURIComponent(b),
					sid = decodeURIComponent(s);
				const group = R.groupByBaseDir(R.readAllProjects()).find(
					(g) => g.baseDir === baseDir,
				);
				if (!group?.online)
					return send(res, 409, { error: "인스턴스가 오프라인입니다" });
				const item = S.sendItem(baseDir, sid, id);
				if (!item)
					return send(res, 409, { error: "이미 전송 중인 항목이 있습니다" });
				return send(res, 200, { item });
			}

			m = p.match(
				/^\/api\/projects\/([^/]+)\/sessions\/([^/]+)\/items\/([^/]+)$/,
			);
			if (m) {
				const [, b, s, id] = m;
				const baseDir = decodeURIComponent(b),
					sid = decodeURIComponent(s);
				if (req.method === "DELETE") {
					const ok = S.removeItem(baseDir, sid, id);
					return send(
						res,
						ok ? 200 : 404,
						ok ? { removed: true } : { error: "not found" },
					);
				}
				if (req.method === "PATCH") {
					try {
						const body = await readBody(req);
						const item = S.updateItem(baseDir, sid, id, body.text);
						return item
							? send(res, 200, { item })
							: send(res, 404, { error: "not found" });
					} catch (e: any) {
						return send(res, 400, { error: e.message });
					}
				}
			}

			m = p.match(/^\/api\/projects\/([^/]+)\/sessions\/([^/]+)\/reorder$/);
			if (m && req.method === "PATCH") {
				const [, b, s] = m;
				try {
					const body = await readBody(req);
					const items = S.reorderItems(
						decodeURIComponent(b),
						decodeURIComponent(s),
						body.from,
						body.to,
					);
					return send(res, 200, { items });
				} catch (e: any) {
					return send(res, 400, { error: e.message });
				}
			}

			m = p.match(/^\/api\/projects\/([^/]+)\/sessions\/([^/]+)\/items$/);
			if (m && req.method === "POST") {
				const [, b, s] = m;
				try {
					const body = await readBody(req);
					return send(res, 201, {
						item: S.addItem(
							decodeURIComponent(b),
							decodeURIComponent(s),
							body.text,
						),
					});
				} catch (e: any) {
					return send(res, 400, { error: e.message });
				}
			}

			if (serveStatic(p, res)) return;
			return send(res, 404, { error: "Not found" });
		} catch (_err) {
			if (!res.headersSent) send(res, 500, { error: "Internal server error" });
		}
	};
}

export function isPortInUse(
	port: number,
	host = "127.0.0.1",
): Promise<boolean> {
	return new Promise((resolve) => {
		const sock = new net.Socket();
		sock.once("connect", () => {
			sock.destroy();
			resolve(true);
		});
		sock.once("error", () => {
			sock.destroy();
			resolve(false);
		});
		sock.connect(port, host);
	});
}

export async function tryListen(
	port: number,
	handler: http.RequestListener,
): Promise<http.Server | null> {
	if (await isPortInUse(port)) return null;
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		server.once("error", () => resolve(null));
		server.listen(port, "127.0.0.1", () => resolve(server));
	});
}

export async function isOpencodeQHost(port: number): Promise<boolean> {
	try {
		const r = await fetch(`http://127.0.0.1:${port}/health`, {
			signal: AbortSignal.timeout(2000),
		});
		if (!r.ok) return false;
		const j = (await r.json()) as any;
		return j?.app === HEALTH_SIGNATURE;
	} catch {
		return false;
	}
}
