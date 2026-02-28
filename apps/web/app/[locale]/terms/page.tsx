import { Link } from "@/i18n/routing";
import { Sparkles } from "lucide-react";

export const metadata = {
    title: "Terms of Service — AutoApply AI",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="container max-w-3xl py-12">
                <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
                <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed">
                    <p className="text-muted-foreground">Last updated: February 2026</p>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
                        <p>By accessing and using AutoApply AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
                        <p>AutoApply AI is an AI-powered career assistant that helps users discover job listings, score job-candidate compatibility, and generate tailored resumes and cover letters. The Service does not apply to jobs on your behalf and does not guarantee employment outcomes.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">3. User Responsibilities</h2>
                        <p>You are responsible for:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Providing accurate and truthful information in your CV and profile</li>
                            <li>Reviewing all AI-generated documents before submission to employers</li>
                            <li>Ensuring that all information in generated documents is factual</li>
                            <li>Maintaining the security of your account credentials</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">4. AI-Generated Content</h2>
                        <p>The Service uses AI to tailor documents. While we implement anti-hallucination guardrails, AI may occasionally produce inaccurate content. You must review and verify all generated documents before use. AutoApply AI is not liable for any consequences arising from unverified AI-generated content.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Collection and Privacy</h2>
                        <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. We collect and process personal data as described therein, in compliance with GDPR and applicable data protection regulations.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">6. Subscription and Payments</h2>
                        <p>Paid plans are billed via Stripe. Subscriptions auto-renew unless cancelled. Refunds are handled on a case-by-case basis within 14 days of purchase. Credit packs are non-refundable once used.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">7. Prohibited Uses</h2>
                        <p>You may not:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>Use the Service to generate fraudulent or misleading documents</li>
                            <li>Attempt to circumvent rate limits or access controls</li>
                            <li>Reverse engineer or scrape the Service</li>
                            <li>Use the Service in violation of any applicable law</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">8. Limitation of Liability</h2>
                        <p>AutoApply AI is provided &quot;as is&quot; without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">9. Termination</h2>
                        <p>We may suspend or terminate your account for violations of these Terms. You may delete your account at any time via Settings. Upon deletion, all your data will be permanently removed in compliance with GDPR.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to Terms</h2>
                        <p>We may update these Terms from time to time. Material changes will be communicated via email or in-app notification. Continued use after changes constitutes acceptance.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact</h2>
                        <p>For questions about these Terms, contact us at <Link href="/contact" className="text-primary underline">our contact page</Link>.</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
