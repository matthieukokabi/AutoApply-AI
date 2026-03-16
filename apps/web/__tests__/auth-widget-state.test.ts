import { describe, expect, it } from "vitest";
import { getAuthWidgetState } from "@/lib/auth-widget-state";

describe("getAuthWidgetState", () => {
    it("shows loading while Clerk is not loaded yet", () => {
        const state = getAuthWidgetState({
            isLoaded: false,
            hasWidgetMounted: false,
            showTimeoutFallback: false,
            showWidgetFallback: false,
        });

        expect(state.shouldShowLoadingCard).toBe(true);
        expect(state.shouldShowRecoveryCard).toBe(false);
    });

    it("shows loading while Clerk is loaded but widget not mounted yet", () => {
        const state = getAuthWidgetState({
            isLoaded: true,
            hasWidgetMounted: false,
            showTimeoutFallback: false,
            showWidgetFallback: false,
        });

        expect(state.shouldShowLoadingCard).toBe(true);
        expect(state.shouldShowRecoveryCard).toBe(false);
    });

    it("shows recovery after load timeout when Clerk is still not loaded", () => {
        const state = getAuthWidgetState({
            isLoaded: false,
            hasWidgetMounted: false,
            showTimeoutFallback: true,
            showWidgetFallback: false,
        });

        expect(state.shouldShowLoadingCard).toBe(false);
        expect(state.shouldShowRecoveryCard).toBe(true);
    });

    it("shows recovery when widget mount fallback is triggered", () => {
        const state = getAuthWidgetState({
            isLoaded: true,
            hasWidgetMounted: false,
            showTimeoutFallback: false,
            showWidgetFallback: true,
        });

        expect(state.shouldShowLoadingCard).toBe(false);
        expect(state.shouldShowRecoveryCard).toBe(true);
    });

    it("shows neither loading nor recovery when widget is mounted", () => {
        const state = getAuthWidgetState({
            isLoaded: true,
            hasWidgetMounted: true,
            showTimeoutFallback: false,
            showWidgetFallback: false,
        });

        expect(state.shouldShowLoadingCard).toBe(false);
        expect(state.shouldShowRecoveryCard).toBe(false);
    });
});
