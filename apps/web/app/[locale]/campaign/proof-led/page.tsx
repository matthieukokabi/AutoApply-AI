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
    proofTitle: string;
    proofPoints: string[];
    processTitle: string;
    processPoints: string[];
    trustTitle: string;
    trustPoints: string[];
    ctaTitle: string;
    ctaSubtitle: string;
};

const campaignCopyByLocale: Record<string, CampaignCopy> = {
    en: {
        badge: "Proof-Led Campaign",
        title: "Evidence that your applications can move faster",
        subtitle:
            "AutoApply AI gives you measurable signals and a repeatable workflow, so each application is more focused and less random.",
        proofTitle: "What users validate first",
        proofPoints: [
            "Clear compatibility scoring before spending effort.",
            "ATS-ready document structure with role-specific keyword coverage.",
            "Consistent process that reduces missed follow-ups.",
        ],
        processTitle: "How the workflow stays efficient",
        processPoints: [
            "Upload profile and CV once, then tailor per role.",
            "Generate focused CV and cover letter drafts in minutes.",
            "Track each application stage in one dashboard.",
        ],
        trustTitle: "Trust and quality safeguards",
        trustPoints: [
            "No fabricated skills or fake claims",
            "Privacy-first session and account handling",
            "Human review remains in your control",
            "Free onboarding starts without card details",
        ],
        ctaTitle: "Validate the workflow on your next applications",
        ctaSubtitle: "Start on Free, then move to Pro or Unlimited when you need higher volume.",
    },
    fr: {
        badge: "Campagne orientee preuve",
        title: "Des preuves concretes pour accelerer vos candidatures",
        subtitle:
            "AutoApply AI fournit des signaux mesurables et un workflow repetable pour des candidatures plus ciblees.",
        proofTitle: "Ce que les utilisateurs valident d'abord",
        proofPoints: [
            "Score de compatibilite clair avant d'investir du temps.",
            "Structure ATS et mots-cles adaptes au poste.",
            "Processus constant qui reduit les suivis oublies.",
        ],
        processTitle: "Pourquoi le workflow reste efficace",
        processPoints: [
            "Profil et CV importes une fois, adaptation par offre ensuite.",
            "Brouillons CV et lettre en quelques minutes.",
            "Suivi de chaque etape dans un seul tableau de bord.",
        ],
        trustTitle: "Garde-fous qualite et confiance",
        trustPoints: [
            "Aucune competence inventee",
            "Gestion compte/session orientee confidentialite",
            "Validation humaine toujours possible",
            "Demarrage Free possible sans carte bancaire",
        ],
        ctaTitle: "Testez ce workflow sur vos prochaines candidatures",
        ctaSubtitle: "Commencez en Free, puis passez Pro/Unlimited selon votre volume.",
    },
    de: {
        badge: "Proof-Led Kampagne",
        title: "Nachweise, dass Bewerbungen schneller laufen konnen",
        subtitle:
            "AutoApply AI liefert messbare Signale und einen wiederholbaren Ablauf fur fokussiertere Bewerbungen.",
        proofTitle: "Was Nutzer zuerst validieren",
        proofPoints: [
            "Klarer Kompatibilitats-Score vor Zeitinvestition.",
            "ATS-taugliche Struktur mit passenden Keywords.",
            "Konstanter Prozess mit weniger verpassten Follow-ups.",
        ],
        processTitle: "Warum der Ablauf effizient bleibt",
        processPoints: [
            "Profil und CV einmal hochladen, dann je Stelle anpassen.",
            "CV- und Anschreiben-Entwurfe in wenigen Minuten.",
            "Status jeder Bewerbung in einem Dashboard.",
        ],
        trustTitle: "Qualitat und Vertrauen",
        trustPoints: [
            "Keine erfundenen Skills",
            "Datenschutzorientierte Session-Verwaltung",
            "Menschliche Endkontrolle bleibt bei dir",
            "Free-Onboarding startet ohne Kartendaten",
        ],
        ctaTitle: "Teste den Workflow mit deinen nachsten Bewerbungen",
        ctaSubtitle: "Starte mit Free und wechsle bei Bedarf zu Pro oder Unlimited.",
    },
    es: {
        badge: "Campana orientada a prueba",
        title: "Pruebas claras para avanzar mas rapido en tus candidaturas",
        subtitle:
            "AutoApply AI aporta senales medibles y un flujo repetible para enviar solicitudes con mas foco.",
        proofTitle: "Lo que validan primero los usuarios",
        proofPoints: [
            "Puntuacion de compatibilidad antes de invertir tiempo.",
            "Estructura ATS con keywords por vacante.",
            "Proceso constante con menos seguimientos perdidos.",
        ],
        processTitle: "Como se mantiene eficiente el flujo",
        processPoints: [
            "Subes perfil y CV una vez, luego adaptas por puesto.",
            "Borradores CV/carta en minutos.",
            "Seguimiento de cada etapa en un unico panel.",
        ],
        trustTitle: "Calidad y confianza",
        trustPoints: [
            "Sin habilidades inventadas",
            "Gestion de cuenta/sesion con enfoque privacidad",
            "Control final humano siempre disponible",
            "El onboarding Free comienza sin tarjeta",
        ],
        ctaTitle: "Valida el flujo en tus proximas candidaturas",
        ctaSubtitle: "Empieza en Free y escala a Pro o Unlimited cuando haga falta.",
    },
    it: {
        badge: "Campagna orientata alla prova",
        title: "Prove concrete per accelerare le tue candidature",
        subtitle:
            "AutoApply AI offre segnali misurabili e un flusso ripetibile per candidature piu mirate.",
        proofTitle: "Cosa verificano subito gli utenti",
        proofPoints: [
            "Compatibility score chiaro prima di investire tempo.",
            "Struttura ATS-ready con keyword per ruolo.",
            "Processo costante con meno follow-up persi.",
        ],
        processTitle: "Perche il flusso resta efficiente",
        processPoints: [
            "Carichi profilo e CV una volta, poi adatti per ruolo.",
            "Bozze CV/lettera in pochi minuti.",
            "Tracking completo in una sola dashboard.",
        ],
        trustTitle: "Qualita e fiducia",
        trustPoints: [
            "Nessuna skill inventata",
            "Gestione account/sessione privacy-first",
            "Controllo finale umano sempre disponibile",
            "Onboarding Free senza inserire carta",
        ],
        ctaTitle: "Prova il workflow sulle prossime candidature",
        ctaSubtitle: "Inizia con Free, poi passa a Pro o Unlimited quando serve.",
    },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    const title = `AutoApply AI — ${copy.badge}`;
    const description = copy.subtitle;
    const parity = buildCanonicalOgParity(locale, "/campaign/proof-led");
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

export default async function ProofLedCampaignPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations();
    const copy = campaignCopyByLocale[locale] ?? campaignCopyByLocale.en;
    const { signInPath, signUpPath } = getAuthPathsForLocale(locale);

    const fromPath = `/${locale}/campaign/proof-led`;
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
                                <BarChart3 className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.proofTitle}</CardTitle>
                                <CardDescription>{copy.proofPoints[0]}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                <p>{copy.proofPoints[1]}</p>
                                <p>{copy.proofPoints[2]}</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/60">
                            <CardHeader>
                                <Clock3 className="mb-2 h-5 w-5 text-primary" />
                                <CardTitle>{copy.processTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.processPoints.map((point) => (
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
                                <CardTitle>{copy.trustTitle}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-muted-foreground">
                                {copy.trustPoints.map((point) => (
                                    <div key={point} className="flex items-start gap-2">
                                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
