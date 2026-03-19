"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Locale = "en" | "fr" | "de" | "es" | "it";

const supportedLocales: Locale[] = ["en", "fr", "de", "es", "it"];

const cookieConsentCopy: Record<
    Locale,
    {
        messageBeforeLink: string;
        messageAfterLink: string;
        privacyLabel: string;
        decline: string;
        accept: string;
    }
> = {
    en: {
        messageBeforeLink:
            "We use essential cookies for authentication and session management. Optional analytics tags are loaded only if you accept.",
        messageAfterLink: "",
        privacyLabel: "Privacy Policy",
        decline: "Decline",
        accept: "Accept",
    },
    fr: {
        messageBeforeLink:
            "Nous utilisons des cookies essentiels pour l'authentification et la gestion de session. Les balises analytiques optionnelles sont chargées uniquement si vous acceptez.",
        messageAfterLink: "",
        privacyLabel: "Politique de confidentialité",
        decline: "Refuser",
        accept: "Accepter",
    },
    de: {
        messageBeforeLink:
            "Wir verwenden essentielle Cookies für Authentifizierung und Sitzungsverwaltung. Optionale Analyse-Tags werden nur geladen, wenn Sie zustimmen.",
        messageAfterLink: "",
        privacyLabel: "Datenschutzerklärung",
        decline: "Ablehnen",
        accept: "Akzeptieren",
    },
    es: {
        messageBeforeLink:
            "Usamos cookies esenciales para autenticación y gestión de sesión. Las etiquetas analíticas opcionales solo se cargan si aceptas.",
        messageAfterLink: "",
        privacyLabel: "Política de privacidad",
        decline: "Rechazar",
        accept: "Aceptar",
    },
    it: {
        messageBeforeLink:
            "Utilizziamo cookie essenziali per autenticazione e gestione sessione. I tag analitici opzionali vengono caricati solo se accetti.",
        messageAfterLink: "",
        privacyLabel: "Informativa sulla privacy",
        decline: "Rifiuta",
        accept: "Accetta",
    },
};

function detectLocaleFromPath(pathname: string): Locale {
    const segment = pathname.split("/")[1];
    return supportedLocales.includes(segment as Locale)
        ? (segment as Locale)
        : "en";
}

export function CookieConsent() {
    const [visible, setVisible] = useState(false);
    const [locale, setLocale] = useState<Locale>("en");

    useEffect(() => {
        try {
            if (typeof window !== "undefined") {
                setLocale(detectLocaleFromPath(window.location.pathname));
            }
            const consent = localStorage.getItem("cookie-consent");
            if (!consent) {
                // Small delay so it doesn't flash on load
                const timer = setTimeout(() => setVisible(true), 1000);
                return () => clearTimeout(timer);
            }
        } catch {
            // localStorage may be blocked in private browsing or strict privacy mode
            // Silently skip — don't show banner if we can't store preference
        }
    }, []);

    function accept() {
        try { localStorage.setItem("cookie-consent", "accepted"); } catch { /* noop */ }
        window.dispatchEvent(new Event("cookie-consent-updated"));
        setVisible(false);
    }

    function decline() {
        try { localStorage.setItem("cookie-consent", "declined"); } catch { /* noop */ }
        window.dispatchEvent(new Event("cookie-consent-updated"));
        setVisible(false);
    }

    if (!visible) return null;

    const copy = cookieConsentCopy[locale];
    const privacyHref = `/${locale}/privacy`;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 overflow-x-clip border-t bg-background p-3 shadow-lg sm:p-4">
            <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
                    {copy.messageBeforeLink}{" "}
                    <a href={privacyHref} className="underline text-foreground">
                        {copy.privacyLabel}
                    </a>
                    {copy.messageAfterLink}
                </p>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
                    <Button variant="outline" size="sm" className="w-full" onClick={decline}>
                        {copy.decline}
                    </Button>
                    <Button size="sm" className="w-full" onClick={accept}>
                        {copy.accept}
                    </Button>
                </div>
            </div>
        </div>
    );
}
