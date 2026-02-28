import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CheckoutButton } from "@/components/checkout-button";
import {
    ArrowRight,
    FileText,
    Search,
    Sparkles,
    Shield,
    BarChart3,
    Zap,
    Check,
} from "lucide-react";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
    const t = await getTranslations({ locale, namespace: "hero" });
    return {
        title: `AutoApply AI — ${t("badge")}`,
        description: t("description"),
        alternates: {
            languages: {
                en: "/",
                fr: "/fr",
                de: "/de",
                es: "/es",
                it: "/it",
            },
        },
    };
}

export default async function LandingPage({ params: { locale } }: { params: { locale: string } }) {
    setRequestLocale(locale);

    // If user is already signed in, redirect to dashboard
    const { userId } = auth();
    if (userId) {
        redirect("/dashboard");
    }

    const t = await getTranslations();

    return (
        <div className="flex flex-col min-h-screen">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center">
                    <div className="mr-4 flex">
                        <Link href="/" className="mr-6 flex items-center space-x-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            <span className="font-bold text-xl">AutoApply AI</span>
                        </Link>
                    </div>
                    <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                        <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.features")}
                        </Link>
                        <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.pricing")}
                        </Link>
                        <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.howItWorks")}
                        </Link>
                    </nav>
                    <div className="flex flex-1 items-center justify-end space-x-2">
                        <LanguageSwitcher />
                        <ThemeToggle />
                        <Link href="/sign-in">
                            <Button variant="ghost">{t("nav.signIn")}</Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button>{t("nav.getStarted")}</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="container flex flex-col items-center gap-6 pb-12 pt-20 md:pt-32 text-center">
                <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                    {t("hero.badge")}
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
                    {t("hero.titleStart")}{" "}
                    <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                        {t("hero.titleHighlight")}
                    </span>
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl leading-relaxed">
                    {t("hero.description")}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    <Link href="/sign-up">
                        <Button size="lg" className="gap-2 px-8">
                            {t("hero.startFree")} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="#pricing">
                        <Button size="lg" variant="outline" className="px-8">
                            {t("hero.viewPricing")}
                        </Button>
                    </Link>
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    {t("hero.noCreditCard")}
                </p>
            </section>

            {/* Stats Bar */}
            <section className="border-y bg-muted/50">
                <div className="container py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl font-bold text-primary">4</div>
                            <div className="text-sm text-muted-foreground mt-1">{t("stats.jobApis")}</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">100+</div>
                            <div className="text-sm text-muted-foreground mt-1">{t("stats.atsKeywords")}</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">0</div>
                            <div className="text-sm text-muted-foreground mt-1">{t("stats.fabricatedSkills")}</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">4h</div>
                            <div className="text-sm text-muted-foreground mt-1">{t("stats.discoveryCycle")}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="container py-20">
                <h2 className="text-3xl font-bold text-center mb-4">
                    {t("howItWorks.title")}
                </h2>
                <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                    {t("howItWorks.subtitle")}
                </p>
                <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">1</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{t("howItWorks.step1Title")}</h3>
                        <p className="text-sm text-muted-foreground">{t("howItWorks.step1Desc")}</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">2</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{t("howItWorks.step2Title")}</h3>
                        <p className="text-sm text-muted-foreground">{t("howItWorks.step2Desc")}</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">3</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{t("howItWorks.step3Title")}</h3>
                        <p className="text-sm text-muted-foreground">{t("howItWorks.step3Desc")}</p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="bg-muted/30">
                <div className="container py-20">
                    <h2 className="text-3xl font-bold text-center mb-4">
                        {t("features.title")}
                    </h2>
                    <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                        {t("features.subtitle")}
                    </p>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            { icon: Search, titleKey: "features.smartDiscovery", descKey: "features.smartDiscoveryDesc" },
                            { icon: BarChart3, titleKey: "features.aiScoring", descKey: "features.aiScoringDesc" },
                            { icon: FileText, titleKey: "features.atsDocuments", descKey: "features.atsDocumentsDesc" },
                            { icon: Zap, titleKey: "features.automatedPipeline", descKey: "features.automatedPipelineDesc" },
                            { icon: Shield, titleKey: "features.privacyFirst", descKey: "features.privacyFirstDesc" },
                            { icon: Sparkles, titleKey: "features.antiHallucination", descKey: "features.antiHallucinationDesc" },
                        ].map((feature) => (
                            <Card key={feature.titleKey} className="bg-card/50 hover:bg-card transition-colors">
                                <CardHeader>
                                    <feature.icon className="h-10 w-10 text-primary mb-2" />
                                    <CardTitle className="text-lg">{t(feature.titleKey)}</CardTitle>
                                    <CardDescription className="leading-relaxed">
                                        {t(feature.descKey)}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="container py-20">
                <h2 className="text-3xl font-bold text-center mb-4">
                    {t("pricing.title")}
                </h2>
                <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                    {t("pricing.subtitle")}
                </p>
                <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                    {/* Free */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{t("pricing.free")}</CardTitle>
                            <CardDescription>{t("pricing.freeDesc")}</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$0</span>
                                <span className="text-muted-foreground">{t("pricing.month")}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.freeDocs")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.manualOnly")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.basicDashboard")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.cvUpload")}
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/sign-up" className="w-full">
                                <Button variant="outline" className="w-full">
                                    {t("hero.startFree")}
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>

                    {/* Pro */}
                    <Card className="flex flex-col border-primary shadow-lg relative">
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                            {t("pricing.mostPopular")}
                        </Badge>
                        <CardHeader>
                            <CardTitle>{t("pricing.pro")}</CardTitle>
                            <CardDescription>{t("pricing.proDesc")}</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$29</span>
                                <span className="text-muted-foreground">{t("pricing.month")}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t("pricing.proSaveYearly")}</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.proDocs")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.autoDiscovery")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.fullKanban")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.aiCompatibility")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.emailNotifications")}
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <CheckoutButton plan="pro_monthly" className="w-full">
                                {t("pricing.getProMonthly")}
                            </CheckoutButton>
                            <CheckoutButton plan="pro_yearly" variant="ghost" className="w-full text-xs">
                                {t("pricing.proSaveYearly")}
                            </CheckoutButton>
                        </CardFooter>
                    </Card>

                    {/* Unlimited */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{t("pricing.unlimited")}</CardTitle>
                            <CardDescription>{t("pricing.unlimitedDesc")}</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$79</span>
                                <span className="text-muted-foreground">{t("pricing.month")}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t("pricing.unlimitedSaveYearly")}</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.unlimitedTailoring")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.priorityProcessing")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.apiAccess")}
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    {t("pricing.everythingInPro")}
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <CheckoutButton plan="unlimited" variant="outline" className="w-full">
                                {t("pricing.goUnlimited")}
                            </CheckoutButton>
                            <CheckoutButton plan="unlimited_yearly" variant="ghost" className="w-full text-xs">
                                {t("pricing.unlimitedSaveYearly")}
                            </CheckoutButton>
                        </CardFooter>
                    </Card>
                </div>

                <div className="text-center mt-10 p-6 rounded-lg bg-muted/50 max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground mb-3">
                        {t("pricing.creditPackDesc")}
                    </p>
                    <CheckoutButton plan="credit_pack" variant="secondary">
                        {t("pricing.buyCreditPack")}
                    </CheckoutButton>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-primary text-primary-foreground">
                <div className="container py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        {t("cta.title")}
                    </h2>
                    <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
                        {t("cta.subtitle")}
                    </p>
                    <Link href="/sign-up">
                        <Button size="lg" variant="secondary" className="gap-2 px-8">
                            {t("cta.getStarted")} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-12 mt-auto">
                <div className="container">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center space-x-2 mb-4">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <span className="font-semibold">AutoApply AI</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("footer.tagline")}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">{t("footer.product")}</h4>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <Link href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</Link>
                                <Link href="#pricing" className="hover:text-foreground transition-colors">{t("nav.pricing")}</Link>
                                <Link href="#how-it-works" className="hover:text-foreground transition-colors">{t("nav.howItWorks")}</Link>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">{t("footer.legal")}</h4>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <Link href="/terms" className="hover:text-foreground transition-colors">{t("footer.termsOfService")}</Link>
                                <Link href="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacyPolicy")}</Link>
                                <Link href="/contact" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">{t("footer.dataSources")}</h4>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <span>Adzuna API</span>
                                <span>The Muse API</span>
                                <span>Remotive API</span>
                                <span>Arbeitnow API</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} AutoApply AI. {t("footer.rights")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {t("footer.officialApis")}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
