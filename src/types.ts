export type ItemStatus = "queued" | "pending" | "sent" | "done" | "failed";

export interface QueueItem {
	id: string;
	text: string;
	createdAt: string;
	status: ItemStatus;
	pendingAt?: string;
	sentAt?: string;
	completedAt?: string;
	error?: string;
}

export interface QueueData {
	items: QueueItem[];
	updatedAt: string;
}

export interface SessionInfo {
	sessionId: string;
	status: string;
	title?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface ProjectRecord {
	baseDir: string;
	sessions: SessionInfo[];
	heartbeat: string;
	instanceId: string;
}

export interface ProjectGroup {
	baseDir: string;
	online: boolean;
	sessions: SessionInfo[];
}
