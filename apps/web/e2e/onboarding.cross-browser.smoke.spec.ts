import { expect, test } from "@playwright/test";

type ViewportCase = {
    name: string;
    width: number;
    height: number;
};

function parseLocales(): string[] {
    const envValue = process.env.SMOKE_LOCALES;
    if (!envValue) {
        return ["fr", "en"];
    }

    return envValue
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean);
}

function parseViewports(): ViewportCase[] {
    const envValue = process.env.SMOKE_VIEWPORTS;
    if (!envValue) {
        return [
            { name: "desktop", width: 1280, height: 800 },
            { name: "mobile", width: 390, height: 844 },
        ];
    }

    return envValue
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [name, widthRaw, heightRaw] = entry.split(":");
            const width = Number(widthRaw);
            const height = Number(heightRaw);

            if (!name || Number.isNaN(width) || Number.isNaN(height)) {
                throw new Error(
                    `Invalid SMOKE_VIEWPORTS entry "${entry}". Expected format name:width:height`
                );
            }

            return { name, width, height };
        });
}

const locales = parseLocales();
const viewports = parseViewports();

for (const locale of locales) {
    for (const viewportCase of viewports) {
        const label = `${locale} ${viewportCase.name}`;
        const fromParam = encodeURIComponent(`/${locale}`);
        const signUpIntentPath = `/${locale}/sign-up?upgrade=pro_monthly&from=${fromParam}`;

        test.describe(`onboarding smoke ${label}`, () => {
            test.use({
                viewport: { width: viewportCase.width, height: viewportCase.height },
            });

            test("pricing CTA reaches sign-up without unauthorized/overflow", async ({ page }) => {
                await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });

                const landing = await page.evaluate(() => ({
                    hasOverflow:
                        document.documentElement.scrollWidth > window.innerWidth + 1,
                    hasUnauthorizedText: document.body.innerText
                        .toLowerCase()
                        .includes("unauthorized"),
                }));

                expect(landing.hasOverflow).toBe(false);
                expect(landing.hasUnauthorizedText).toBe(false);

                const clicked = await page.evaluate(() => {
                    const textOf = (element: Element | null) =>
                        (element?.textContent || "").toLowerCase();

                    const candidates = Array.from(
                        document.querySelectorAll("#pricing a, #pricing button")
                    );

                    const target = candidates.find((element) => {
                        const text = textOf(element);
                        return text.includes("pro") && text.includes("29");
                    });

                    if (!target) {
                        return false;
                    }

                    (target as HTMLElement).click();
                    return true;
                });

                expect(clicked).toBe(true);
                await expect(page).toHaveURL(/\/sign-up/, { timeout: 20_000 });
                await page.waitForTimeout(2500);

                const signUp = await page.evaluate(() => {
                    const bodyText = document.body.innerText.toLowerCase();

                    return {
                        hasOverflow:
                            document.documentElement.scrollWidth > window.innerWidth + 1,
                        hasUnauthorizedText: bodyText.includes("unauthorized"),
                        hasAuthSurface:
                            Boolean(
                                document.querySelector(
                                    "input[type=email], button[type=submit], .cl-card, [data-clerk-component]"
                                )
                            ) ||
                            bodyText.includes("loading secure sign-up") ||
                            bodyText.includes("open diagnostics") ||
                            bodyText.includes("run auth diagnostics"),
                    };
                });

                expect(signUp.hasOverflow).toBe(false);
                expect(signUp.hasUnauthorizedText).toBe(false);
                expect(signUp.hasAuthSurface).toBe(true);
            });

            test("mobile webkit pro CTA works before hydration", async ({
                browser,
                browserName,
            }) => {
                test.skip(
                    browserName !== "webkit" || viewportCase.name !== "mobile",
                    "This guardrail is specific to mobile WebKit pre-hydration behavior."
                );

                const noJsContext = await browser.newContext({
                    javaScriptEnabled: false,
                    viewport: {
                        width: viewportCase.width,
                        height: viewportCase.height,
                    },
                });

                try {
                    const noJsPage = await noJsContext.newPage();
                    await noJsPage.goto(`/${locale}`, {
                        waitUntil: "domcontentloaded",
                    });

                    const proMonthlyCta = noJsPage
                        .locator('#pricing a[href*="upgrade=pro_monthly"]')
                        .first();

                    await expect(proMonthlyCta).toBeVisible();
                    await expect(proMonthlyCta).toHaveAttribute(
                        "href",
                        /\/sign-up\?upgrade=pro_monthly&from=/
                    );

                    await proMonthlyCta.click();
                    await expect(noJsPage).toHaveURL(
                        /\/sign-up\?upgrade=pro_monthly&from=/
                    );
                } finally {
                    await noJsContext.close();
                }
            });

            test("blocked auth still shows recovery surface", async ({ context, page }) => {
                await context.route("**/*", (route) => {
                    const requestHost = new URL(route.request().url()).hostname.toLowerCase();
                    if (requestHost.includes("clerk")) {
                        route.abort();
                        return;
                    }

                    route.continue();
                });

                await page.goto(signUpIntentPath, {
                    waitUntil: "domcontentloaded",
                });

                await page.waitForTimeout(9500);

                const blocked = await page.evaluate(() => {
                    const bodyText = document.body.innerText.toLowerCase();

                    return {
                        hasOverflow:
                            document.documentElement.scrollWidth > window.innerWidth + 1,
                        hasUnauthorizedText: bodyText.includes("unauthorized"),
                        hasRecoverySurface:
                            bodyText.includes("secure sign-up is currently blocked") ||
                            bodyText.includes("open diagnostics") ||
                            bodyText.includes("run auth diagnostics") ||
                            bodyText.includes("go to sign in") ||
                            bodyText.includes("loading secure sign-up"),
                    };
                });

                expect(blocked.hasOverflow).toBe(false);
                expect(blocked.hasUnauthorizedText).toBe(false);
                expect(blocked.hasRecoverySurface).toBe(true);
            });
        });
    }
}
