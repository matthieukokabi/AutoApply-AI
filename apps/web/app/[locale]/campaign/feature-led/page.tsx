import { Link } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BarChart3, CheckCircle2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutButton } from "@/components/checkout-button";
import { buildAuthIntentUrl, getAuthPathsForLocale } from "@/lib/checkout-intent";
import { buildLocaleAlternates } from "@/lib/seo";

type CampaignCopy = {
    badge: string;
    title: string;
    subtitle: string;
    featureTitle: string;
    featurePoints: string[];
    automationTitle: string;
    automationPoints: string[];
    qualityTitle: string;
    qualityPoints: string[];
    ctaTitle: string;
    ctaSubtitle: string;
};

const campaignCopyByLocale: Record<string, CampaignCopy> = {
    en: {
        badge: "Feature-Led Campaign",
        title: "All core job-application features in one focused workspace",
        subtitle:
            "AutoApply AI combines job discovery, tailored documents, compatibility scoring, and tracking so your weekly application flow stays consistent.",
        featureTitle: "Core features you get immediately",
        featurePoints: [
            "ATS-aligned CV and cover-letter tailoring",
            "Compatibility scoring to prioritize stronger matches",
            "Application pipeline tracking across stages",
        ],
        automationTitle: "Automation without losing control",
        automationPoints: [
            "Import your profile once, then adapt per role.",
            "Generate draft documents in minutes, then review.",
            "Keep everything in one dashboard for follow-up.",
        ],
        qualityTitle: "Built with quality guardrails",
        qualityPoints: [
            "No fabricated experience generation",
            "Privacy-first authentication and sessions",
            "Clear upgrade path from Free to Pro/Unlimited",
        ],
        ctaTitle: "Try the complete feature set on your next applications",
        ctaSubtitle: "Start free today, then scale with paid plans when you need more throughput.",
    },
    fr: {
        badge: "Campagne orientee fonctionnalites",
        title: "Toutes les fonctionnalites candidature dans un seul espace",
        subtitle:
            "AutoApply AI regroupe recherche d'offres, documents adaptes, score de compatibilite et suivi pour un flux hebdomadaire stable.",
        featureTitle: "Fonctionnalites disponibles immediatement",
        featurePoints: [
            "Adaptation CV et lettre orientee ATS",
            "Score de compatibilite pour mieux prioriser",
            "Suivi de candidature par etape",
        ],
        automationTitle: "Automatisation sans perdre le controle",
        automationPoints: [
            "Import profil une fois, adaptation par offre ensuite.",
            "Generation rapide de brouillons puis validation humaine.",
            "Tableau unique pour le suivi et les relances.",
        ],
        qualityTitle: "Concu avec garde-fous qualite",
        qualityPoints: [
            "Aucune experience inventee",
            "Authentification et sessions orientees confidentialite",
            "Parcours clair de Free vers Pro/Unlimited",
        ],
        ctaTitle: "Testez le set complet sur vos prochaines candidatures",
        ctaSubtitle: "Demarrez en Free puis passez en plan payant selon votre rythme.",
    },
    de: {
        badge: "Feature-Led Kampagne",
        title: "Alle Kernfunktionen fur Bewerbungen in einem Workspace",
        subtitle:
            "AutoApply AI verbindet Jobsuche, angepasste Unterlagen, Kompatibilitats-Score und Tracking fur einen stabilen Prozess.",
        featureTitle: "Kernfunktionen ab dem ersten Tag",
        featurePoints: [
            "ATS-orientierte Lebenslauf- und Anschreiben-Anpassung",
            "Kompatibilitats-Score fur bessere Priorisierung",
            "Pipeline-Tracking uber alle Bewerbungsstufen",
        ],
        automationTitle: "Automatisierung mit Kontrolle",
        automationPoints: [
            "Profil einmal importieren, dann pro Rolle anpassen.",
            "Schnelle Entwurfe erstellen und final prufen.",
            "Alles in einem Dashboard fur Follow-ups halten.",
        ],
        qualityTitle: "Mit Qualitats-Gelander gebaut",
        qualityPoints: [
            "Keine erfundenen Erfahrungen",
            "Datenschutzorientierte Auth- und Session-Logik",
            "Klarer Upgrade-Pfad von Free zu Pro/Unlimited",
        ],
        ctaTitle: "Teste alle Features bei deinen nachsten Bewerbungen",
        ctaSubtitle: "Starte kostenlos und skaliere bei Bedarf auf Paid-Plane.",
    },
    es: {
        badge: "Campana orientada a funcionalidades",
        title: "Todas las funciones clave de candidatura en un solo espacio",
        subtitle:
            "AutoApply AI une descubrimiento de empleo, documentos adaptados, score de compatibilidad y seguimiento en un flujo estable.",
        featureTitle: "Funciones principales desde el inicio",
        featurePoints: [
            "Tailoring de CV y carta alineado a ATS",
            "Puntuacion de compatibilidad para priorizar",
            "Tracking del pipeline por etapas",
        ],
        automationTitle: "Automatizacion manteniendo control",
        automationPoints: [
            "Importa perfil una vez y adapta por vacante.",
            "Genera borradores en minutos y revisa antes de enviar.",
            "Gestiona seguimiento en un unico panel.",
        ],
        qualityTitle: "Construido con guardrails de calidad",
        qualityPoints: [
            "Sin experiencia inventada",
            "Autenticacion y sesiones con enfoque privacidad",
            "Ruta clara de Free a Pro/Unlimited",
        ],
        ctaTitle: "Prueba todo el set de funciones en tus proximas candidaturas",
        ctaSubtitle: "Empieza gratis y sube de plan cuando necesites mas volumen.",
    },
    it: {
        badge: "Campagna orientata alle funzionalita",
        title: "Tutte le funzioni chiave candidatura in un unico workspace",
        subtitle:
            "AutoApply AI unisce job discovery, documenti mirati, compatibility score e tracking in un flusso costante.",
        featureTitle: "Funzionalita core disponibili subito",
        featurePoints: [
            "Tailoring CV e lettera allineato ATS",
            "Compatibility score per priorizzare meglio",
            "Tracking pipeline su ogni fase candidatura",
        ],
        automationTitle: "Automazione senza perdere controllo",
        automationPoints: [
            "Import profilo una volta, poi adatti per ruolo.",
            "Generi bozze in minuti e fai revisione finale.",
            "Gestisci follow-up da una dashboard unica.",
        ],
        qualityTitle: "Costruito con guardrail di qualita",
        qualityPoints: [
            "Nessuna esperienza inventata",
            "Autenticazione e sessioni privacy-first",
            "Percorso upgrade chiaro da Free a Pro/Unlimited",
        ],
        ctaTitle: "Prova tutte le funzionalita sulle prossime candidature",
        ctaSubtitle: "Inizia gratis e scala ai piani paid quando serve piu throughput.",
    },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    return {
        title: `AutoApply AI — ${copy.badge}`,
        description: copy.subtitle,
        alternates: buildLocaleAlternates(locale, "/campaign/feature-led"),
    };
}

export default async function FeatureLedCampaignPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations();
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    const { signInPath, signUpPath } = getAuthPathsForLocale(locale);

    const fromPath = `/${locale}/campaign/feature-led`;
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
                        <Link href={signInPath}>
                            <Button variant="ghost">{t("nav.signIn")}</Button>
                        </Link>
                        <Link href={signUpPath}>
                            <Button>{t("nav.getStarted")}</Button>
                        </Link>
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
                            <Link href={signUpPath}>
                                <Button size="lg" className="gap-2">
                                    {t("hero.startFree")} <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
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
                                <Sparkles className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.featureTitle}</CardTitle>
                                <CardDescription>{copy.featurePoints[0]}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p>{copy.featurePoints[1]}</p>
                                <p>{copy.featurePoints[2]}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                            <CardHeader>
                                <Zap className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.automationTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.automationPoints.map((point) => (
                                    <div key={point} className="flex items-start gap-2">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        <p>{point}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                            <CardHeader>
                                <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.qualityTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.qualityPoints.map((point) => (
                                    <div key={point} className="flex items-start gap-2">
                                        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                        <p>{point}</p>
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
                            <Link href={signUpPath}>
                                <Button className="h-11 px-8">{t("hero.startFree")}</Button>
                            </Link>
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
