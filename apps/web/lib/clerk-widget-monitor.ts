const CLERK_WIDGET_SELECTORS = [
    ".cl-rootBox",
    ".cl-card",
    "[data-clerk-component]",
    "[data-localization-key]",
].join(",");

export function hasMountedClerkWidget(root: ParentNode | null | undefined): boolean {
    if (!root || typeof root.querySelector !== "function") {
        return false;
    }

    return root.querySelector(CLERK_WIDGET_SELECTORS) !== null;
}
