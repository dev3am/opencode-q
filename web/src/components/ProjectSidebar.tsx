import type { ProjectState } from "../api/client";
import { useTranslation } from "../i18n/useTranslation";
import { formatRelativeTime, sortSessionsByRecent } from "../lib/sessions";

interface Props {
	projects: ProjectState[];
	selectedBaseDir: string;
	selectedSessionId: string;
	onSelectProject: (baseDir: string) => void;
	onSelectSession: (sessionId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
	busy: "bg-yellow-400",
	idle: "bg-gray-300",
	error: "bg-red-400",
};

export default function ProjectSidebar({
	projects,
	selectedBaseDir,
	selectedSessionId,
	onSelectProject,
	onSelectSession,
}: Props) {
	const { lang } = useTranslation();
	const now = Date.now();

	return (
		<div className="flex flex-col w-72 shrink-0 bg-gray-50 overflow-y-auto">
			<div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm px-3 pt-3 pb-2">
				<div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
					Projects
				</div>
			</div>

			<div className="flex flex-col gap-1.5 px-2 pb-4">
				{projects.map((p) => {
					const name = p.baseDir.split("/").pop() || p.baseDir;
					const isActiveProject = p.baseDir === selectedBaseDir;
					return (
						<div
							key={p.baseDir}
							className={`rounded-lg transition-all ${isActiveProject ? "bg-white shadow-sm ring-1 ring-gray-200/80" : "hover:bg-white/60"}`}
						>
							<div
								onClick={() => onSelectProject(p.baseDir)}
								className={`px-3 py-2 cursor-pointer text-sm ${p.online ? "" : "opacity-40"}`}
							>
								<div className="flex items-center gap-2">
									<div
										className={`w-2 h-2 rounded-full flex-shrink-0 ${p.online ? "bg-green-500" : "bg-gray-400"}`}
									/>
									<div className="min-w-0 flex-1">
										<div className="font-semibold text-gray-800 truncate">
											{name}
										</div>
										<div className="text-[10px] text-gray-400 mt-0.5 truncate">
											{p.baseDir}
										</div>
									</div>
								</div>
							</div>

							{isActiveProject && p.sessions.length > 0 && (
								<div className="max-h-48 overflow-y-auto px-2 pb-2">
									{sortSessionsByRecent(p.sessions).map((s) => {
										const isActive = s.sessionId === selectedSessionId;
										const label = s.title?.trim()
											? s.title
											: s.sessionId.slice(0, 8);
										const when = formatRelativeTime(s.updatedAt, lang, now);
										return (
											<div
												key={s.sessionId}
												onClick={() => onSelectSession(s.sessionId)}
												className={`px-2 py-1.5 rounded-md mb-0.5 cursor-pointer text-xs transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-600"}`}
											>
												<div className="flex items-center gap-2">
													<div
														className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] || "bg-gray-300"}`}
													/>
													<span
														className="truncate flex-1"
														title={s.title || s.sessionId}
													>
														{label}
													</span>
												</div>
												{when && (
													<div className="text-[10px] text-gray-400 mt-0.5 pl-3.5">
														{when}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
