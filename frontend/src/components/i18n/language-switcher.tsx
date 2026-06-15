"use client";

import { useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  changeLocale,
  getLocalePreference,
  normalizeLocale,
  supportedLocales,
  type LocaleCode,
  type LocalePreference,
} from "@/i18n";

let preferenceCallbacks: Array<() => void> = [];

function emitPreferenceChange() {
  preferenceCallbacks.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("locale-preference-changed", emitPreferenceChange);
  window.addEventListener("storage", emitPreferenceChange);
}

function subscribePreference(callback: () => void) {
  preferenceCallbacks = [...preferenceCallbacks, callback];
  return () => {
    preferenceCallbacks = preferenceCallbacks.filter((cb) => cb !== callback);
  };
}

function getSnapshotPreference(): LocalePreference {
  return getLocalePreference();
}

function getServerSnapshotPreference(): LocalePreference {
  return "system";
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const preference = useSyncExternalStore(
    subscribePreference,
    getSnapshotPreference,
    getServerSnapshotPreference
  );

  const activeLocale =
    normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? "en-US";
  const resolvedLabel =
    supportedLocales.find((l) => l.code === activeLocale)?.nativeLabel ?? activeLocale;

  async function handleChange(value: string) {
    if (value === "system") {
      await changeLocale("system");
      return;
    }
    const locale = normalizeLocale(value);
    if (locale) await changeLocale(locale as LocaleCode);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 shadow-sm">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <label htmlFor="app-locale" className="sr-only">
        {t("language.label")}
      </label>
      <select
        id="app-locale"
        value={preference}
        onChange={(e) => void handleChange(e.target.value)}
        className="max-w-[140px] cursor-pointer truncate bg-transparent text-xs font-medium text-foreground outline-none"
        title={
          preference === "system"
            ? t("language.followSystemWithLanguage", { language: resolvedLabel })
            : resolvedLabel
        }
      >
        <option value="system">{t("language.followSystem")}</option>
        <option value="en-US">{t("language.enUS")}</option>
        <option value="zh-CN">{t("language.zhCN")}</option>
      </select>
    </div>
  );
}
