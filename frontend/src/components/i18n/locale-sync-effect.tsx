"use client";

import { useEffect } from "react";
import { getLocalePreference, resolveLocalePreference } from "@/i18n";
import i18n from "@/i18n";

export function LocaleSyncEffect() {
  useEffect(() => {
    const preference = getLocalePreference();
    if (preference !== "system") return;

    const sync = () => {
      if (getLocalePreference() !== "system") return;
      const resolved = resolveLocalePreference("system");
      const active = i18n.resolvedLanguage || i18n.language;
      if (active !== resolved) {
        void i18n.changeLanguage(resolved);
      }
    };

    window.addEventListener("languagechange", sync);
    return () => window.removeEventListener("languagechange", sync);
  }, []);

  return null;
}
