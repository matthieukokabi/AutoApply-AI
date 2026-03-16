export function resetViewportScroll(win: Window = window, doc: Document = document) {
    try {
        win.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
        win.scrollTo(0, 0);
    }

    if (doc.documentElement) {
        doc.documentElement.scrollLeft = 0;
        doc.documentElement.scrollTop = 0;
    }

    if (doc.body) {
        doc.body.scrollLeft = 0;
        doc.body.scrollTop = 0;
    }
}
