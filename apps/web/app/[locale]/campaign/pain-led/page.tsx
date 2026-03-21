import { Link } from "@/i18n/routing";
import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutButton } from "@/components/checkout-button";
import { buildAuthIntentUrl, getAuthPathsForLocale } from "@/lib/checkout-intent";
import { buildCanonicalOgParity } from "@/lib/seo";

type CampaignCopy = {
    badge: string;
    title: string;
    subtitle: string;
    painTitle: string;
    painPoints: string[];
    outcomeTitle: string;
    outcomes: string[];
    proofTitle: string;
    proofs: string[];
    ctaTitle: string;
    ctaSubtitle: string;
};

const campaignCopyByLocale: Record<string, CampaignCopy> = {
    en: {
        badge: "Pain-Led Campaign",
        title: "Stop losing hours on applications that never get replies",
        subtitle:
            "AutoApply AI turns each job post into an ATS-ready CV + cover letter in minutes so you can apply faster with less fatigue.",
        painTitle: "What blocks most candidates today",
        painPoints: [
            "You spend 30-60 minutes rewriting your CV for every role.",
            "You are never sure if keywords match the ATS screen.",
            "Application tracking gets scattered across tabs and notes.",
        ],
        outcomeTitle: "What changes with AutoApply AI",
        outcomes: [
            "Tailored CV and cover letter drafts in a focused workflow.",
            "Compatibility scoring to prioritize roles worth your time.",
            "Single dashboard for discovery, tailoring, and follow-up.",
        ],
        proofTitle: "Built for trustworthy applications",
        proofs: [
            "ATS-focused structure and keyword coverage",
            "No fabricated skills or fake experience generation",
            "Privacy-first account and session handling",
            "Free plan requires no card details to start",
        ],
        ctaTitle: "Start free, then upgrade when you are ready",
        ctaSubtitle: "No card required for Free. Upgrade path stays in your locale and account flow.",
    },
    fr: {
        badge: "Campagne orientee douleur",
        title: "Arretez de perdre des heures sur des candidatures sans reponse",
        subtitle:
            "AutoApply AI transforme chaque offre en CV + lettre ATS en quelques minutes pour postuler plus vite, avec moins de fatigue.",
        painTitle: "Ce qui bloque la plupart des candidats",
        painPoints: [
            "Vous passez 30-60 minutes a reecrire votre CV pour chaque poste.",
            "Vous ne savez jamais si les mots-cles passent les filtres ATS.",
            "Le suivi des candidatures est disperse entre onglets et notes.",
        ],
        outcomeTitle: "Ce qui change avec AutoApply AI",
        outcomes: [
            "Brouillons CV et lettre personnalises dans un flux guide.",
            "Score de compatibilite pour prioriser les offres utiles.",
            "Un seul tableau de bord pour recherche, adaptation et suivi.",
        ],
        proofTitle: "Concu pour des candidatures fiables",
        proofs: [
            "Structure orientee ATS et couverture des mots-cles",
            "Aucune competence inventee ni experience fabriquee",
            "Gestion compte/session orientee protection des donnees",
            "Le plan Free demarre sans carte bancaire",
        ],
        ctaTitle: "Demarrez gratuitement, passez Pro ensuite",
        ctaSubtitle: "Aucune carte requise pour Free. Le parcours upgrade reste dans votre langue.",
    },
    de: {
        badge: "Pain-Led Kampagne",
        title: "Verliere keine Stunden mehr fur Bewerbungen ohne Antwort",
        subtitle:
            "AutoApply AI macht aus jeder Stelle in Minuten einen ATS-tauglichen Lebenslauf plus Anschreiben, damit du schneller bewerben kannst.",
        painTitle: "Was Kandidaten heute ausbremst",
        painPoints: [
            "30-60 Minuten Lebenslauf-Anpassung pro Stelle.",
            "Unsicherheit bei ATS-Keywords und Trefferquote.",
            "Bewerbungsstatus verteilt uber Tabs und Notizen.",
        ],
        outcomeTitle: "Was sich mit AutoApply AI andert",
        outcomes: [
            "Passende CV/Anschreiben-Entwurfe in einem fokussierten Ablauf.",
            "Kompatibilitats-Score fur bessere Priorisierung.",
            "Ein Dashboard fur Suche, Anpassung und Follow-up.",
        ],
        proofTitle: "Fur verlassliche Bewerbungen gebaut",
        proofs: [
            "ATS-fokussierte Struktur und Keyword-Abdeckung",
            "Keine erfundenen Skills oder Fake-Erfahrungen",
            "Datenschutzorientiertes Account- und Session-Handling",
            "Der Free-Plan startet ohne Kartenangaben",
        ],
        ctaTitle: "Kostenlos starten, spater upgraden",
        ctaSubtitle: "Kein Karteinsatz fur Free. Upgrade lauft im gleichen Locale-Flow.",
    },
    es: {
        badge: "Campana orientada al dolor",
        title: "Deja de perder horas en solicitudes sin respuesta",
        subtitle:
            "AutoApply AI convierte cada oferta en CV + carta optimizados para ATS en minutos para postular mas rapido.",
        painTitle: "Lo que frena hoy a la mayoria",
        painPoints: [
            "Pasas 30-60 minutos reescribiendo el CV por cada vacante.",
            "No sabes si tus palabras clave pasan ATS.",
            "El seguimiento queda disperso entre pestanas y notas.",
        ],
        outcomeTitle: "Que cambia con AutoApply AI",
        outcomes: [
            "Borradores CV/carta adaptados en un flujo claro.",
            "Puntuacion de compatibilidad para priorizar mejor.",
            "Panel unico para descubrimiento, tailoring y seguimiento.",
        ],
        proofTitle: "Disenado para candidaturas confiables",
        proofs: [
            "Estructura enfocada en ATS y cobertura de keywords",
            "Sin habilidades inventadas ni experiencia falsa",
            "Gestion de cuenta y sesion con enfoque privacidad",
            "El plan Free se activa sin tarjeta bancaria",
        ],
        ctaTitle: "Empieza gratis y escala cuando quieras",
        ctaSubtitle: "Free no requiere tarjeta. El upgrade mantiene tu ruta localizada.",
    },
    it: {
        badge: "Campagna orientata al pain point",
        title: "Smetti di perdere ore su candidature senza risposta",
        subtitle:
            "AutoApply AI trasforma ogni offerta in CV + lettera ATS-ready in pochi minuti per candidarti piu velocemente.",
        painTitle: "Cosa blocca oggi molti candidati",
        painPoints: [
            "30-60 minuti per riscrivere il CV per ogni posizione.",
            "Dubbi continui su keyword e filtro ATS.",
            "Tracking candidature sparso tra tab e note.",
        ],
        outcomeTitle: "Cosa cambia con AutoApply AI",
        outcomes: [
            "Bozze CV e lettera mirate in un flusso guidato.",
            "Compatibility score per dare priorita alle offerte migliori.",
            "Unica dashboard per ricerca, tailoring e follow-up.",
        ],
        proofTitle: "Pensato per candidature affidabili",
        proofs: [
            "Struttura ATS-first con copertura keyword",
            "Nessuna skill inventata o esperienza falsa",
            "Gestione account/sessione con approccio privacy-first",
            "Il piano Free parte senza carta di credito",
        ],
        ctaTitle: "Inizia gratis, passa Pro quando serve",
        ctaSubtitle: "Nessuna carta per Free. L'upgrade resta nel flusso locale.",
    },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    const title = `AutoApply AI — ${copy.badge}`;
    const description = copy.subtitle;
    const parity = buildCanonicalOgParity(locale, "/campaign/pain-led");
    return {
        title,
        description,
        alternates: parity.alternates,
        openGraph: {
            ...parity.openGraph,
            title,
            description,
        },
    };
}

export default async function PainLedCampaignPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations();
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    const { signInPath, signUpPath } = getAuthPathsForLocale(locale);

    const fromPath = `/${locale}/campaign/pain-led`;
    const signUpProMonthlyHref = buildAuthIntentUrl(signUpPath, "pro_monthly", fromPath);
    const signUpUnlimitedHref = buildAuthIntentUrl(signUpPath, "unlimited", fromPath);

    return (
        <div className="min-h-screen overflow-x-hidden bg-background">
            <header className="border-b">
                <div className="container flex h-16 items-center justify-between gap-4">
                    <Link href="/" className="text-lg font-semibold">
                        AutoApply AI
                    </Link>
                    <div className="flex items-center gap-2">
                        <NextLink href={signInPath}>
                            <Button variant="ghost">{t("nav.signIn")}</Button>
                        </NextLink>
                        <NextLink href={signUpPath}>
                            <Button>{t("nav.getStarted")}</Button>
                        </NextLink>
                    </div>
                </div>
            </header>

            <main>
                <section className="container py-16 md:py-24">
                    <div className="mx-auto max-w-4xl text-center">
                        <p className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                            {copy.badge}
                        </p>
                        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{copy.title}</h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{copy.subtitle}</p>
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <NextLink href={signUpPath}>
                                <Button size="lg" className="gap-2">
                                    {t("hero.startFree")} <ArrowRight className="h-4 w-4" />
                                </Button>
                            </NextLink>
                            <CheckoutButton
                                plan="pro_monthly"
                                variant="outline"
                                className="h-11 px-8"
                                fallbackHref={signUpProMonthlyHref}
                            >
                                {t("pricing.getProMonthly")}
                            </CheckoutButton>
                        </div>
                    </div>
                </section>

                <section className="container pb-12">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="bg-card/60">
                            <CardHeader>
                                <Clock3 className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.painTitle}</CardTitle>
                                <CardDescription>{copy.painPoints[0]}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p>{copy.painPoints[1]}</p>
                                <p>{copy.painPoints[2]}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                            <CardHeader>
                                <Target className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.outcomeTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.outcomes.map((outcome) => (
                                    <div key={outcome} className="flex items-start gap-2">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        <p>{outcome}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                            <CardHeader>
                                <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.proofTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.proofs.map((proof) => (
                                    <div key={proof} className="flex items-start gap-2">
                                        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        <p>{proof}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="container pb-20">
                    <Card className="mx-auto max-w-3xl border-primary/20 bg-primary/5">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">{copy.ctaTitle}</CardTitle>
                            <CardDescription>{copy.ctaSubtitle}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <NextLink href={signUpPath}>
                                <Button className="h-11 px-8">{t("hero.startFree")}</Button>
                            </NextLink>
                            <CheckoutButton
                                plan="unlimited"
                                variant="outline"
                                className="h-11 px-8"
                                fallbackHref={signUpUnlimitedHref}
                            >
                                {t("pricing.goUnlimited")}
                            </CheckoutButton>
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
}
