import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type RedirectRule = {
    source: string;
    destination: string;
};

const require = createRequire(import.meta.url);
const nextConfig = require("../next.config.js") as {
    redirects: () => Promise<RedirectRule[]>;
};

function matchRedirect(source: string, pathname: string): { path: string } | null {
    if (!source.includes(":path*")) {
        return source === pathname ? { path: "" } : null;
    }

    const base = source.replace("/:path*", "");
    if (pathname === base) {
        return { path: "" };
    }

    if (pathname.startsWith(`${base}/`)) {
        return { path: pathname.slice(base.length + 1) };
    }

    return null;
}

function applyDestination(destination: string, params: { path: string }): string {
    if (!destination.includes(":path*")) {
        return destination;
    }

    return destination.replace(":path*", params.path);
}

function resolveRedirectPath(pathname: string, rules: RedirectRule[], maxSteps = 5) {
    let current = pathname;
    let hops = 0;
    const visited = new Set<string>([pathname]);

    while (hops < maxSteps) {
        let matched = false;

        for (const rule of rules) {
            const params = matchRedirect(rule.source, current);
            if (!params) {
                continue;
            }

            const next = applyDestination(rule.destination, params);
            hops += 1;
            current = next;
            matched = true;

            if (visited.has(next)) {
                throw new Error(`Redirect loop detected for ${pathname}`);
            }

            visited.add(next);
            break;
        }

        if (!matched) {
            break;
        }
    }

    return {
        hops,
        finalPath: current,
        finalUrl: new URL(current, "https://autoapply.works").toString(),
    };
}

describe("redirect regression", () => {
    it("keeps key bare routes at <=1 redirect hop and expected final URL", async () => {
        const redirects = await nextConfig.redirects();
        const cases = [
            { from: "/", expectedFinalPath: "/en" },
            { from: "/blog", expectedFinalPath: "/en/blog" },
            {
                from: "/blog/ai-cover-letter-writing-guide",
                expectedFinalPath: "/en/blog/ai-cover-letter-writing-guide",
            },
            { from: "/contact", expectedFinalPath: "/en/contact" },
            { from: "/privacy", expectedFinalPath: "/en/privacy" },
            { from: "/terms", expectedFinalPath: "/en/terms" },
            { from: "/roadmap", expectedFinalPath: "/en/roadmap" },
            { from: "/coming-soon", expectedFinalPath: "/en/coming-soon" },
            {
                from: "/campaign/feature-led",
                expectedFinalPath: "/en/campaign/feature-led",
            },
            { from: "/sign-in", expectedFinalPath: "/en/sign-in" },
            { from: "/sign-up", expectedFinalPath: "/en/sign-up" },
        ];

        for (const testCase of cases) {
            const resolution = resolveRedirectPath(testCase.from, redirects);
            expect(resolution.hops).toBeLessThanOrEqual(1);
            expect(resolution.finalPath).toBe(testCase.expectedFinalPath);
            expect(resolution.finalUrl).toBe(
                `https://autoapply.works${testCase.expectedFinalPath}`
            );
        }
    });
});
