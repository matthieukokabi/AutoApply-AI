import { afterEach, describe, expect, it } from "vitest";
import { getAppBaseUrl, toAbsoluteAppUrl } from "@/lib/site-url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
    if (originalAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
});

describe("canonical application origin", () => {
    it("defaults generated public URLs to apply.zuerifix.tech", () => {
        delete process.env.NEXT_PUBLIC_APP_URL;

        expect(getAppBaseUrl()).toBe("https://apply.zuerifix.tech");
        expect(toAbsoluteAppUrl("/en/blog")).toBe(
            "https://apply.zuerifix.tech/en/blog"
        );
    });
});
