import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
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
    Globe,
    Clock,
} from "lucide-react";

export default function LandingPage() {
    // If user is already signed in, redirect to dashboard
    const { userId } = auth();
    if (userId) {
        redirect("/dashboard");
    }

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
                            Features
                        </Link>
                        <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </Link>
                        <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                            How It Works
                        </Link>
                    </nav>
                    <div className="flex flex-1 items-center justify-end space-x-2">
                        <ThemeToggle />
                        <Link href="/sign-in">
                            <Button variant="ghost">Sign In</Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button>Get Started Free</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="container flex flex-col items-center gap-6 pb-12 pt-20 md:pt-32 text-center">
                <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                    AI-Powered Career Assistant
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
                    Land Your Dream Job with{" "}
                    <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                        AI Precision
                    </span>
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl leading-relaxed">
                    AutoApply AI discovers relevant jobs, scores your compatibility, and
                    generates ATS-optimized resumes and cover letters — all tailored to
                    each specific role.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    <Link href="/sign-up">
                        <Button size="lg" className="gap-2 px-8">
                            Start Free <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="#pricing">
                        <Button size="lg" variant="outline" className="px-8">
                            View Pricing
                        </Button>
                    </Link>
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    No credit card required. 3 free tailored documents per month.
                </p>
            </section>

            {/* Stats Bar */}
            <section className="border-y bg-muted/50">
                <div className="container py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl font-bold text-primary">4</div>
                            <div className="text-sm text-muted-foreground mt-1">Job Board APIs</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">100+</div>
                            <div className="text-sm text-muted-foreground mt-1">ATS Keywords Matched</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">0</div>
                            <div className="text-sm text-muted-foreground mt-1">Fabricated Skills</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-primary">4h</div>
                            <div className="text-sm text-muted-foreground mt-1">Auto-Discovery Cycle</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="container py-20">
                <h2 className="text-3xl font-bold text-center mb-4">
                    How It Works
                </h2>
                <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                    Three simple steps from upload to application-ready documents.
                </p>
                <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">1</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Upload Your CV</h3>
                        <p className="text-sm text-muted-foreground">
                            Upload your master CV (PDF, DOCX, or paste text). We extract and structure your experience.
                        </p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">2</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Set Preferences</h3>
                        <p className="text-sm text-muted-foreground">
                            Tell us your target roles, locations, salary range, and remote preferences. We search every 4 hours.
                        </p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="text-xl font-bold text-primary">3</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Get Tailored Docs</h3>
                        <p className="text-sm text-muted-foreground">
                            For each matching job, get a tailored CV and cover letter — ATS-optimized, zero fabrication.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="bg-muted/30">
                <div className="container py-20">
                    <h2 className="text-3xl font-bold text-center mb-4">
                        Built for Serious Job Seekers
                    </h2>
                    <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                        Every feature designed to maximize your chances while keeping your data safe.
                    </p>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            {
                                icon: Search,
                                title: "Smart Job Discovery",
                                description: "Aggregates listings from Adzuna, The Muse, Remotive, and more — all from official APIs. No scraping, no ToS violations.",
                            },
                            {
                                icon: BarChart3,
                                title: "AI Compatibility Scoring",
                                description: "Each job is scored 0-100 against your profile based on skills match (40%), experience (25%), education (15%), and domain relevance (20%).",
                            },
                            {
                                icon: FileText,
                                title: "ATS-Optimized Documents",
                                description: "Tailored resume and cover letter per job, optimized for Applicant Tracking Systems. Keywords injected naturally from your real experience.",
                            },
                            {
                                icon: Zap,
                                title: "Automated Pipeline",
                                description: "Set preferences once. Every 4 hours, new matching jobs are discovered and documents prepared automatically for your review.",
                            },
                            {
                                icon: Shield,
                                title: "Privacy First",
                                description: "GDPR-compliant. No credential storage. No automated logins. Your data stays yours with one-click export and deletion.",
                            },
                            {
                                icon: Sparkles,
                                title: "Anti-Hallucination",
                                description: "Zero tolerance for fabricated content. AI only reorders, rephrases, and emphasizes what's already in your CV. Nothing invented.",
                            },
                        ].map((feature) => (
                            <Card key={feature.title} className="bg-card/50 hover:bg-card transition-colors">
                                <CardHeader>
                                    <feature.icon className="h-10 w-10 text-primary mb-2" />
                                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                                    <CardDescription className="leading-relaxed">
                                        {feature.description}
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
                    Simple, Transparent Pricing
                </h2>
                <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
                    Start free. Upgrade when you&apos;re ready to supercharge your job search.
                </p>
                <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                    {/* Free */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>Free</CardTitle>
                            <CardDescription>Get started with the basics</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$0</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    3 tailored documents/month
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Manual job paste only
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Basic dashboard
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    CV upload &amp; parsing
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/sign-up" className="w-full">
                                <Button variant="outline" className="w-full">
                                    Start Free
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>

                    {/* Pro */}
                    <Card className="flex flex-col border-primary shadow-lg relative">
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                            Most Popular
                        </Badge>
                        <CardHeader>
                            <CardTitle>Pro</CardTitle>
                            <CardDescription>For active job seekers</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$29</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">or $249/year (save 28%)</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    50 tailored documents/month
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Automated job discovery
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Full Kanban dashboard
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    AI compatibility scoring
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Email notifications
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <CheckoutButton plan="pro_monthly" className="w-full">
                                Get Pro — $29/mo
                            </CheckoutButton>
                            <CheckoutButton plan="pro_yearly" variant="ghost" className="w-full text-xs">
                                or $249/year (save 28%)
                            </CheckoutButton>
                        </CardFooter>
                    </Card>

                    {/* Unlimited */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>Unlimited</CardTitle>
                            <CardDescription>No limits, maximum power</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$79</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">or $699/year (save 26%)</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Unlimited tailoring
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Priority processing
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    API access
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    Everything in Pro
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <CheckoutButton plan="unlimited" variant="outline" className="w-full">
                                Go Unlimited — $79/mo
                            </CheckoutButton>
                            <CheckoutButton plan="unlimited_yearly" variant="ghost" className="w-full text-xs">
                                or $699/year (save 26%)
                            </CheckoutButton>
                        </CardFooter>
                    </Card>
                </div>

                <div className="text-center mt-10 p-6 rounded-lg bg-muted/50 max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground mb-3">
                        Need more credits? Get a <strong>Credit Pack</strong> — 10
                        additional documents for <strong>$19</strong> (one-time).
                    </p>
                    <CheckoutButton plan="credit_pack" variant="secondary">
                        Buy Credit Pack — $19
                    </CheckoutButton>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-primary text-primary-foreground">
                <div className="container py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Ready to Transform Your Job Search?
                    </h2>
                    <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
                        Join job seekers who are landing interviews faster with AI-tailored applications.
                    </p>
                    <Link href="/sign-up">
                        <Button size="lg" variant="secondary" className="gap-2 px-8">
                            Get Started Free <ArrowRight className="h-4 w-4" />
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
                                AI-powered career assistant. ATS-optimized, zero fabrication.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">Product</h4>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
                                <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
                                <Link href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">Legal</h4>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
                                <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                                <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-sm">Data Sources</h4>
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
                            &copy; {new Date().getFullYear()} AutoApply AI. All rights reserved.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            All job data sourced from official APIs only. No scraping.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
