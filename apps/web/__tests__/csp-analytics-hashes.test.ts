import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type NextConfigWithHeaders = {
    headers: () => Promise<
        {
            headers: Array<{ key: string; value: string }>;
            source: string;
        }[]
    >;
};

function loadNextConfigWithEnv(env: {
    NEXT_PUBLIC_GTM_ID?: string | null;
    NEXT_PUBLIC_GA_MEASUREMENT_ID?: string | null;
}): NextConfigWithHeaders {
    const modulePath = path.join(process.cwd(), "next.config.js");
    const previousGtmId = process.env.NEXT_PUBLIC_GTM_ID;
    const previousGaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    if (env.NEXT_PUBLIC_GTM_ID === null) {
        delete process.env.NEXT_PUBLIC_GTM_ID;
    } else if (typeof env.NEXT_PUBLIC_GTM_ID === "string") {
        process.env.NEXT_PUBLIC_GTM_ID = env.NEXT_PUBLIC_GTM_ID;
    }

    if (env.NEXT_PUBLIC_GA_MEASUREMENT_ID === null) {
        delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else if (typeof env.NEXT_PUBLIC_GA_MEASUREMENT_ID === "string") {
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    }

    delete require.cache[modulePath];
    const config = require(modulePath) as NextConfigWithHeaders;

    if (previousGtmId === undefined) {
        delete process.env.NEXT_PUBLIC_GTM_ID;
    } else {
        process.env.NEXT_PUBLIC_GTM_ID = previousGtmId;
    }

    if (previousGaId === undefined) {
        delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else {
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousGaId;
    }

    delete require.cache[modulePath];
    return config;
}

async function getScriptPolicies(config: NextConfigWithHeaders) {
    const headersConfig = await config.headers();
    const globalHeaders = headersConfig.find((item) => item.source === "/(.*)");

    if (!globalHeaders) {
        throw new Error("Missing /(.*) security headers config");
    }

    const enforcedCsp = globalHeaders.headers.find(
        (header) => header.key === "Content-Security-Policy"
    )?.value;
    const reportOnlyCsp = globalHeaders.headers.find(
        (header) => header.key === "Content-Security-Policy-Report-Only"
    )?.value;

    return { enforcedCsp: enforcedCsp || "", reportOnlyCsp: reportOnlyCsp || "" };
}

describe("next config CSP analytics hashes", () => {
    it("adds sha256 hash allowances in report-only CSP when GTM inline bootstrap is enabled", async () => {
        const config = loadNextConfigWithEnv({
            NEXT_PUBLIC_GTM_ID: "GTM-TEST123",
            NEXT_PUBLIC_GA_MEASUREMENT_ID: null,
        });
        const { enforcedCsp, reportOnlyCsp } = await getScriptPolicies(config);

        expect(enforcedCsp).toContain("script-src");
        expect(reportOnlyCsp).toContain("script-src");
        expect(enforcedCsp).toContain("'unsafe-inline'");
        expect(enforcedCsp).not.toContain("sha256-");
        expect(enforcedCsp).not.toMatch(/script-src[^;]*\shttps:\s*(?:;|$)/);
        expect(enforcedCsp).toContain("https://clerk.autoapply.works");
        expect(enforcedCsp).toContain("https://www.googletagmanager.com");
        expect(enforcedCsp).toContain(
            "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com"
        );
        expect(enforcedCsp).toContain(
            "form-action 'self' https://checkout.stripe.com"
        );
        expect(enforcedCsp).not.toMatch(/frame-src[^;]*\shttps:\s*(?:;|$)/);
        expect(enforcedCsp).not.toMatch(/form-action[^;]*\shttps:\s*(?:;|$)/);
        expect(enforcedCsp).toContain(
            "connect-src 'self' https://api.clerk.com https://clerk.autoapply.works https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://checkout.stripe.com https://api.stripe.com"
        );
        expect(enforcedCsp).not.toMatch(/connect-src[^;]*\shttps:\s*(?:;|$)/);
        expect(enforcedCsp).not.toMatch(/connect-src[^;]*\swss:\s*(?:;|$)/);
        expect(reportOnlyCsp).toContain("sha256-");
    });

    it("adds sha256 hash allowances in report-only CSP when GA inline bootstrap is enabled", async () => {
        const config = loadNextConfigWithEnv({
            NEXT_PUBLIC_GTM_ID: null,
            NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST12345",
        });
        const { enforcedCsp, reportOnlyCsp } = await getScriptPolicies(config);

        expect(enforcedCsp).toContain("script-src");
        expect(reportOnlyCsp).toContain("script-src");
        expect(enforcedCsp).toContain("'unsafe-inline'");
        expect(enforcedCsp).not.toContain("sha256-");
        expect(enforcedCsp).not.toMatch(/script-src[^;]*\shttps:\s*(?:;|$)/);
        expect(enforcedCsp).toContain("https://clerk.autoapply.works");
        expect(enforcedCsp).toContain("https://www.google-analytics.com");
        expect(reportOnlyCsp).toContain("sha256-");
    });
});
