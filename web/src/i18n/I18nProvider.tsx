import { type ReactNode, useCallback, useState } from "react";
import { type Lang, translations } from "./translations";
import { detectLang, I18nContext } from "./useTranslation";

export function I18nProvider({ children }: { children: ReactNode }) {
	const [lang, setLangState] = useState<Lang>(detectLang);

	const setLang = useCallback((l: Lang) => {
		setLangState(l);
		localStorage.setItem("opencode-q-lang", l);
	}, []);

	const t = useCallback(
		(key: string) => translations[lang][key] || key,
		[lang],
	);

	return (
		<I18nContext.Provider value={{ lang, setLang, t }}>
			{children}
		</I18nContext.Provider>
	);
}
