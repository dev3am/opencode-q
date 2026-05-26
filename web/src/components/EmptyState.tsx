import { useTranslation } from "../i18n/useTranslation"

export default function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-base m-0 mb-1">{t("queue.empty")}</p>
      <p className="text-sm m-0">{t("queue.emptyHint")}</p>
    </div>
  )
}
