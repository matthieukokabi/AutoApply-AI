// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutButton } from "@/components/checkout-button";

vi.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/analytics", () => ({
    trackBeginCheckout: vi.fn(),
}));

describe("CheckoutButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.cookie = "__session=; Max-Age=0; Path=/";
        window.history.replaceState({}, "", "/en");
    });

    it("uses the sign-up fallback without calling checkout", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");

        render(createElement(CheckoutButton, {
            plan: "pro_monthly",
            fallbackHref: "/en/sign-up",
        }, "Choose Pro"));

        fireEvent.click(screen.getByRole("link", { name: "Choose Pro" }));

        await waitFor(() => {
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    it("keeps direct checkout available when no auth fallback is provided", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: "Checkout unavailable" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            })
        );

        render(createElement(CheckoutButton, {
            plan: "pro_monthly",
        }, "Choose Pro"));

        fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it("keeps session-bearing visitors on direct checkout", async () => {
        document.cookie = "__session=session_token; Path=/";
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: "Checkout unavailable" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            })
        );

        render(createElement(CheckoutButton, {
            plan: "pro_monthly",
            fallbackHref: "/en/sign-up",
        }, "Choose Pro"));

        fireEvent.click(screen.getByRole("link", { name: "Choose Pro" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });
});
