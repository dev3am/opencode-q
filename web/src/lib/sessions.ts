export function sortSessionsByRecent<T extends { updatedAt?: string }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0))
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
]

export function formatRelativeTime(iso: string | undefined, lang: string, now: number = Date.now()): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const diffSec = Math.round((t - now) / 1000)
  const abs = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === "second") return rtf.format(Math.round(diffSec / secs), unit)
  }
  return ""
}
