const CLERK_WIDGET_SELECTORS = [
    ".cl-rootBox",
    ".cl-card",
    "[data-clerk-component]",
    "[data-localization-key]",
].join(",");

const CLERK_WIDGET_READY_SELECTORS = [
    "form",
    "input",
    "button",
    "iframe[src*='clerk']",
    "[role='button']",
    "[role='textbox']",
    "[data-clerk-element]",
    ".cl-formButtonPrimary",
    ".cl-socialButtonsBlockButton",
].join(",");

export function hasMountedClerkWidget(root: ParentNode | null | undefined): boolean {
    if (!root || typeof root.querySelector !== "function") {
        return false;
    }

    const widgetRoot = root.querySelector(CLERK_WIDGET_SELECTORS);
    if (!widgetRoot) {
        return false;
    }

    if (
        widgetRoot instanceof Element &&
        widgetRoot.querySelector(CLERK_WIDGET_READY_SELECTORS)
    ) {
        return true;
    }

    const widgetText = widgetRoot.textContent?.trim() ?? "";
    return widgetRoot instanceof HTMLElement &&
        widgetRoot.children.length > 0 &&
        widgetText.length > 0;
}
