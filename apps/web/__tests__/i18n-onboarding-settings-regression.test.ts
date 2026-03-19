import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Messages = Record<string, unknown>;

const NON_EN_LOCALES = ["fr", "de", "es", "it"] as const;

const CRITICAL_TRANSLATION_PATHS = [
    ["dashboard", "settings", "title"],
    ["dashboard", "settings", "automation", "title"],
    ["onboarding", "welcome", "title"],
    ["onboarding", "cv", "title"],
    ["onboarding", "preferences", "title"],
    ["localeError", "title"],
    ["notFoundPage", "title"],
    ["checkoutButton", "genericError"],
] as const;

function loadMessages(locale: string): Messages {
    const absolutePath = path.join(process.cwd(), `messages/${locale}.json`);
    return JSON.parse(readFileSync(absolutePath, "utf-8")) as Messages;
}

function getPathValue(messages: Messages, segments: readonly string[]): string {
    let value: unknown = messages;

    for (const segment of segments) {
        if (!value || typeof value !== "object" || !(segment in value)) {
            throw new Error(`Missing translation path: ${segments.join(".")}`);
        }
        value = (value as Record<string, unknown>)[segment];
    }

    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Invalid translation value at path: ${segments.join(".")}`);
    }

    return value;
}

describe("i18n onboarding/settings regression", () => {
    const enMessages = loadMessages("en");

    it("keeps critical English baseline keys non-empty", () => {
        for (const keyPath of CRITICAL_TRANSLATION_PATHS) {
            const value = getPathValue(enMessages, keyPath);
            expect(value.length).toBeGreaterThan(0);
        }
    });

    it("keeps FR/DE/ES/IT critical keys localized and distinct from English", () => {
        for (const locale of NON_EN_LOCALES) {
            const localeMessages = loadMessages(locale);

            for (const keyPath of CRITICAL_TRANSLATION_PATHS) {
                const localizedValue = getPathValue(localeMessages, keyPath);
                const englishValue = getPathValue(enMessages, keyPath);

                expect(localizedValue.length).toBeGreaterThan(0);
                expect(localizedValue).not.toBe(englishValue);
            }
        }
    });
});
