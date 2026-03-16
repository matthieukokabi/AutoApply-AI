/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { resetViewportScroll } from "@/lib/scroll-reset";

describe("resetViewportScroll", () => {
    it("resets window and document scroll offsets", () => {
        const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

        document.documentElement.scrollLeft = 42;
        document.documentElement.scrollTop = 17;
        document.body.scrollLeft = 25;
        document.body.scrollTop = 9;

        resetViewportScroll(window, document);

        expect(scrollToSpy).toHaveBeenCalledWith({
            top: 0,
            left: 0,
            behavior: "auto",
        });
        expect(document.documentElement.scrollLeft).toBe(0);
        expect(document.documentElement.scrollTop).toBe(0);
        expect(document.body.scrollLeft).toBe(0);
        expect(document.body.scrollTop).toBe(0);

        scrollToSpy.mockRestore();
    });

    it("falls back to positional scrollTo signature when object form fails", () => {
        const erroringScrollTo = vi
            .spyOn(window, "scrollTo")
            .mockImplementation(((firstArg: unknown, secondArg?: unknown) => {
                if (typeof firstArg === "object") {
                    throw new TypeError("unsupported options object");
                }

                return undefined as unknown as void;
            }) as typeof window.scrollTo);

        resetViewportScroll(window, document);

        expect(erroringScrollTo).toHaveBeenNthCalledWith(1, {
            top: 0,
            left: 0,
            behavior: "auto",
        });
        expect(erroringScrollTo).toHaveBeenNthCalledWith(2, 0, 0);

        erroringScrollTo.mockRestore();
    });
});
