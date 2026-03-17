import { Link } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { buildLocaleAlternates } from "@/lib/seo";
import {
    Sparkles,
    CheckCircle2,
    Hammer,
    CalendarClock,
    Lightbulb,
    ArrowRight,
    FileText,
    Mail,
    Search,
    BarChart3,
    GripVertical,
    Globe,
    Shield,
    Zap,
    Smartphone,
    Bell,
    TrendingUp,
    Chrome,
    MessageSquare,
    Linkedin,
    BellRing,
    Palette,
    Users,
    DollarSign,
    Video,
    GraduationCap,
} from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "roadmap" });
    return {
        title: `${t("title")} — AutoApply AI`,
        description: t("description"),
        alternates: buildLocaleAlternates(locale, "/roadmap"),
    };
}

// Roadmap items grouped by status
const shippedItems = [
    { key: "ai_cv", icon: FileText },
    { key: "cover_letter", icon: Mail },
    { key: "job_apis", icon: Search },
    { key: "scoring", icon: BarChart3 },
    { key: "kanban", icon: GripVertical },
    { key: "languages", icon: Globe },
    { key: "gdpr", icon: Shield },
    { key: "anti_hallucination", icon: Sparkles },
    { key: "pipeline", icon: Zap },
];

const inProgressItems = [
    { key: "mobile", icon: Smartphone },
    { key: "notifications", icon: Bell },
    { key: "analytics", icon: TrendingUp },
];

const plannedItems = [
    { key: "chrome", icon: Chrome },
    { key: "interview", icon: MessageSquare },
    { key: "linkedin", icon: Linkedin },
    { key: "alerts", icon: BellRing },
    { key: "tone", icon: Palette },
];

const consideringItems = [
    { key: "teams", icon: Users },
    { key: "salary", icon: DollarSign },
    { key: "mock", icon: Video },
    { key: "skills", icon: GraduationCap },
];

export default async function RoadmapPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations();

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: t("roadmap.title"),
        description: t("roadmap.description"),
        url: `https://autoapply.works/${locale === "en" ? "" : locale + "/"}roadmap`,
        isPartOf: {
            "@type": "WebSite",
            name: "AutoApply AI",
            url: "https://autoapply.works",
        },
    };

    return (
        <div className="flex flex-col min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center">
                    <div className="mr-4 flex">
                        <Link href="/" className="mr-6 flex items-center space-x-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            <span className="font-bold text-xl">AutoApply AI</span>
                        </Link>
                    </div>
                    <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                        <Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.features")}
                        </Link>
                        <Link href="/#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.pricing")}
                        </Link>
                        <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t("nav.blog")}
                        </Link>
                        <Link href="/roadmap" className="text-foreground font-semibold transition-colors">
                            {t("nav.roadmap")}
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
            <section className="container pt-16 pb-12 text-center">
                <Badge variant="secondary" className="px-4 py-1.5 text-sm mb-6">
                    {t("roadmap.builtInPublic")}
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                    {t("roadmap.title")}
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    {t("roadmap.description")}
                </p>
            </section>

            {/* Shipped */}
            <section className="container pb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t("roadmap.shipped")}</h2>
                        <p className="text-sm text-muted-foreground">{t("roadmap.shippedDesc")}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shippedItems.map((item) => (
                        <Card key={item.key} className="bg-green-500/5 border-green-500/20 hover:bg-green-500/10 transition-colors">
                            <CardContent className="flex items-start gap-3 p-4">
                                <item.icon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t(`roadmap.item_${item.key}`)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t(`roadmap.item_${item.key}_desc`)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* In Progress */}
            <section className="container pb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Hammer className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t("roadmap.inProgress")}</h2>
                        <p className="text-sm text-muted-foreground">{t("roadmap.inProgressDesc")}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inProgressItems.map((item) => (
                        <Card key={item.key} className="bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition-colors">
                            <CardContent className="flex items-start gap-3 p-4">
                                <item.icon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t(`roadmap.item_${item.key}`)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t(`roadmap.item_${item.key}_desc`)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Planned */}
            <section className="container pb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CalendarClock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t("roadmap.planned")}</h2>
                        <p className="text-sm text-muted-foreground">{t("roadmap.plannedDesc")}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {plannedItems.map((item) => (
                        <Card key={item.key} className="bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 transition-colors">
                            <CardContent className="flex items-start gap-3 p-4">
                                <item.icon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t(`roadmap.item_${item.key}`)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t(`roadmap.item_${item.key}_desc`)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Under Consideration */}
            <section className="container pb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Lightbulb className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{t("roadmap.considering")}</h2>
                        <p className="text-sm text-muted-foreground">{t("roadmap.consideringDesc")}</p>
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {consideringItems.map((item) => (
                        <Card key={item.key} className="bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10 transition-colors">
                            <CardContent className="flex items-start gap-3 p-4">
                                <item.icon className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t(`roadmap.item_${item.key}`)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t(`roadmap.item_${item.key}_desc`)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-muted/50 border-t">
                <div className="container py-16 text-center">
                    <h2 className="text-2xl font-bold mb-3">
                        {t("roadmap.suggest")}
                    </h2>
                    <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                        {t("roadmap.suggestDesc")}
                    </p>
                    <Link href="/contact">
                        <Button size="lg" className="gap-2">
                            {t("roadmap.contactUs")} <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 mt-auto">
                <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AutoApply AI</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} AutoApply AI. {t("footer.rights")}
                    </p>
                </div>
            </footer>
        </div>
    );
}
