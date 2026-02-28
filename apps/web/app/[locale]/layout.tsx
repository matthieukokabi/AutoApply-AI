import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

const seoByLocale: Record<string, { title: string; description: string; keywords: string[] }> = {
    en: {
        title: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        description: "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking. Free to start.",
        keywords: ["AI resume builder", "ai cover letter generator", "ATS optimization", "ats resume builder", "job search automation", "resume tailoring tool", "ai job matching", "automated job application", "job application tracker", "ai cv builder"],
    },
    fr: {
        title: "AutoApply AI — CV et Lettre de Motivation Adaptés à Chaque Offre par IA",
        description: "Plateforme de recherche d'emploi IA. CV optimisés ATS, lettres de motivation IA, correspondance emploi depuis 7+ sources, suivi de candidatures.",
        keywords: ["générateur de cv ia", "lettre de motivation ia", "cv optimisé ats", "recherche emploi automatisée", "outil suivi candidatures", "intelligence artificielle cv", "cv ats compatible", "créer cv avec ia"],
    },
    de: {
        title: "AutoApply AI — Lebenslauf & Anschreiben per KI an Jede Stelle Anpassen",
        description: "KI-Jobsuche-Plattform. ATS-optimierte Lebensläufe, KI-Anschreiben, Job-Matching aus 7+ Quellen und Bewerbungstracker.",
        keywords: ["ki lebenslauf erstellen", "bewerbungsschreiben ki", "ats optimierter lebenslauf", "ki bewerbung schreiben", "bewerbungstracker", "ki jobsuche", "anschreiben generator ki", "lebenslauf generator ki"],
    },
    es: {
        title: "AutoApply AI — CV y Carta de Presentación Adaptados a Cada Oferta con IA",
        description: "Plataforma IA de búsqueda de empleo. CV optimizados para ATS, cartas generadas por IA, búsqueda en 7+ fuentes y seguimiento de candidaturas.",
        keywords: ["generador de cv con ia", "carta de presentación ia", "curriculum vitae optimizado ats", "ia para buscar empleo", "seguimiento de candidaturas", "crear cv con inteligencia artificial", "optimizador de curriculum"],
    },
    it: {
        title: "AutoApply AI — CV e Lettera di Presentazione Adattati a Ogni Offerta con IA",
        description: "Piattaforma IA per la ricerca lavoro. CV ottimizzati ATS, lettere di presentazione IA, matching da 7+ fonti e monitoraggio candidature.",
        keywords: ["generatore cv con ia", "lettera di presentazione ia", "curriculum vitae ottimizzato ats", "ia per cercare lavoro", "ricerca lavoro automatizzata", "monitoraggio candidature lavoro", "creare cv con intelligenza artificiale"],
    },
};

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
    const seo = seoByLocale[locale] || seoByLocale.en;
    return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords,
        alternates: {
            languages: Object.fromEntries(
                locales.map((l) => [l, `/${l}`])
            ),
        },
        openGraph: {
            title: seo.title,
            description: seo.description,
            locale: locale,
            alternateLocale: locales.filter((l) => l !== locale),
        },
    };
}

export default async function LocaleLayout({
    children,
    params: { locale },
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    // Validate locale
    if (!locales.includes(locale as Locale)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <NextIntlClientProvider messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}
