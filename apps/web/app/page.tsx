import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileText, Search, Sparkles, Shield, BarChart3, Zap } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <div className="mr-4 flex">
                        <Link href="/" className="mr-6 flex items-center space-x-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            <span className="font-bold text-xl">AutoApply AI</span>
                        </Link>
                    </div>
                    <div className="flex flex-1 items-center justify-end space-x-4">
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
            <section className="container flex flex-col items-center gap-4 pb-8 pt-16 md:pt-24 text-center">
                <Badge variant="secondary" className="mb-4">
                    🚀 AI-Powered Career Assistant
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                    Land Your Dream Job with{" "}
                    <span className="text-primary">AI Precision</span>
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
                    AutoApply AI discovers relevant jobs, scores your compatibility, and
                    generates ATS-optimized resumes and cover letters — all tailored to
                    each specific role.
                </p>
                <div className="flex gap-4 mt-4">
                    <Link href="/sign-up">
                        <Button size="lg" className="gap-2">
                            Start Free <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="#pricing">
                        <Button size="lg" variant="outline">
                            View Pricing
                        </Button>
                    </Link>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    ⚠️ AI-tailored content is based solely on your provided CV. Always
                    verify before submitting.
                </p>
            </section>

            {/* Features */}
            <section className="container py-16">
                <h2 className="text-3xl font-bold text-center mb-12">
                    How AutoApply AI Works
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <Search className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>Smart Job Discovery</CardTitle>
                            <CardDescription>
                                Aggregates listings from Adzuna, The Muse, Remotive, and more —
                                all from official APIs. No scraping.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <BarChart3 className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>AI Compatibility Scoring</CardTitle>
                            <CardDescription>
                                Each job is scored 0-100 against your profile based on skills,
                                experience, education, and domain relevance.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <FileText className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>ATS-Optimized Documents</CardTitle>
                            <CardDescription>
                                Tailored resume and cover letter generated per job, optimized
                                for Applicant Tracking Systems. Never fabricated.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Zap className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>Automated Pipeline</CardTitle>
                            <CardDescription>
                                Set your preferences once. Every 4 hours, new matching jobs are
                                discovered and documents prepared for your review.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Shield className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>Privacy First</CardTitle>
                            <CardDescription>
                                GDPR-compliant. No credential storage. No automated logins. Your
                                data stays yours with one-click deletion.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Sparkles className="h-10 w-10 text-primary mb-2" />
                            <CardTitle>Anti-Hallucination</CardTitle>
                            <CardDescription>
                                Zero tolerance for fabricated content. AI only reorders,
                                rephrases, and emphasizes what&apos;s already in your CV.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="container py-16">
                <h2 className="text-3xl font-bold text-center mb-4">
                    Simple, Transparent Pricing
                </h2>
                <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
                    Start free. Upgrade when you&apos;re ready to supercharge your job search.
                </p>
                <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
                    {/* Free */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Free</CardTitle>
                            <CardDescription>Get started with the basics</CardDescription>
                            <div className="text-3xl font-bold">$0</div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p>✓ 3 tailored docs/month</p>
                            <p>✓ Manual job paste only</p>
                            <p>✓ Basic dashboard</p>
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
                    <Card className="border-primary shadow-lg relative">
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                            Most Popular
                        </Badge>
                        <CardHeader>
                            <CardTitle>Pro</CardTitle>
                            <CardDescription>For active job seekers</CardDescription>
                            <div className="text-3xl font-bold">
                                $29<span className="text-lg font-normal text-muted-foreground">/mo</span>
                            </div>
                            <p className="text-xs text-muted-foreground">or $249/year (save 28%)</p>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p>✓ 50 tailored docs/month</p>
                            <p>✓ Automated job discovery</p>
                            <p>✓ Full Kanban dashboard</p>
                            <p>✓ Compatibility scoring</p>
                            <p>✓ Email notifications</p>
                        </CardContent>
                        <CardFooter>
                            <Link href="/sign-up" className="w-full">
                                <Button className="w-full">Get Pro</Button>
                            </Link>
                        </CardFooter>
                    </Card>

                    {/* Unlimited */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Unlimited</CardTitle>
                            <CardDescription>No limits, maximum power</CardDescription>
                            <div className="text-3xl font-bold">
                                $79<span className="text-lg font-normal text-muted-foreground">/mo</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p>✓ Unlimited tailoring</p>
                            <p>✓ Priority processing</p>
                            <p>✓ API access</p>
                            <p>✓ Everything in Pro</p>
                        </CardContent>
                        <CardFooter>
                            <Link href="/sign-up" className="w-full">
                                <Button variant="outline" className="w-full">
                                    Go Unlimited
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </div>

                <div className="text-center mt-8">
                    <p className="text-sm text-muted-foreground">
                        Need more credits? Get a <strong>Credit Pack</strong> — 10
                        additional documents for <strong>$19</strong> (one-time).
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 mt-auto">
                <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span className="font-semibold">AutoApply AI</span>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                        <Link href="/terms" className="hover:underline">Terms of Service</Link>
                        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                        <Link href="/contact" className="hover:underline">Contact</Link>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} AutoApply AI. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
