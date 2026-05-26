import { useState, useRef, useEffect } from "react"
import { useTranslation, type Lang } from "../i18n/useTranslation"
import type { StatusDetail } from "../hooks/useSSE"

interface HeaderProps {
  sessionId: string
  realSessionId?: string | null
  sessionStatus: string
  statusDetail: StatusDetail
  onRetry: () => void
  onSkip: () => void
}

function shortId(id: string): string {
  return id.length > 12 ? "…" + id.slice(-8) : id
}

const STATUS_COLORS: Record<string, string> = {
  idle: "#22c55e",
  busy: "#3b82f6",
  error: "#ef4444",
  "waiting-permission": "#f97316",
  "waiting-question": "#f97316",
  unknown: "#9ca3af",
}

const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  idle: "status.idle",
  busy: "status.busy",
  error: "status.error",
  "waiting-permission": "status.waiting-permission",
  "waiting-question": "status.waiting-question",
  unknown: "status.unknown",
}

export default function Header({ sessionId, realSessionId, sessionStatus, statusDetail, onRetry, onSkip }: HeaderProps) {
  const { t, lang, setLang } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const color = STATUS_COLORS[sessionStatus] || STATUS_COLORS.unknown
  const labelKey = STATUS_TRANSLATION_KEYS[sessionStatus] || sessionStatus
  const isError = sessionStatus === "error"
  const isBusy = sessionStatus === "busy"

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const langLabels: Record<Lang, string> = { en: "EN", ko: "한국어", ja: "日本語", zh: "中文" }

  return (
    <div className="mb-4 pb-2 border-b border-gray-200">
      <div className="flex justify-between items-center">
        <h1 className="m-0 text-lg font-bold text-gray-800">{t("app.title")}</h1>
        <div className="flex items-center gap-2">
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="text-[11px] text-gray-400 hover:text-gray-600 bg-transparent border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
            >{langLabels[lang]}</button>
            {open && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-sm z-50 py-0.5 min-w-[68px]">
                {(Object.keys(langLabels) as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setOpen(false) }}
                    className={`block w-full text-left px-3 py-1 text-xs cursor-pointer transition-colors ${l === lang ? "text-gray-800 bg-gray-100" : "text-gray-500 hover:bg-gray-50"}`}
                  >{langLabels[l]}</button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {realSessionId ? shortId(realSessionId) : sessionId}
          </span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: color + "18", color }}>
            <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? "animate-pulse" : ""}`} style={{ background: color }} />
            {t(labelKey)}
          </span>
        </div>
      </div>

      {isError && (
        <div className="mt-2 pl-2 border-l-2 border-red-500">
          <div className="text-xs text-red-600 mb-1">
            {t("header.executionFailed")}: {statusDetail.message || t("header.unknownError")}
          </div>
          <div className="flex gap-2">
            <button onClick={onRetry} className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors cursor-pointer">{t("header.retry")}</button>
            <button onClick={onSkip} className="px-3 py-1 text-xs font-medium bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors cursor-pointer">{t("header.skip")}</button>
          </div>
        </div>
      )}
    </div>
  )
}
