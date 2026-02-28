import { Link } from "@/i18n/routing";
import { Sparkles } from "lucide-react";

export const metadata = {
    title: "Privacy Policy — AutoApply AI",
};

export default function PrivacyPage() {
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
                <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
                <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed">
                    <p className="text-muted-foreground">Last updated: February 2026</p>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">1. Data We Collect</h2>
                        <p>We collect the following categories of personal data:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Account data:</strong> Name, email address (via Clerk authentication)</li>
                            <li><strong>CV data:</strong> Resume text and structured profile information you provide</li>
                            <li><strong>Job preferences:</strong> Target titles, locations, salary expectations</li>
                            <li><strong>Usage data:</strong> Application tracking, document generation history</li>
                            <li><strong>Payment data:</strong> Processed by Stripe; we do not store card details</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Your Data</h2>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li>To provide AI-powered job matching and document generation</li>
                            <li>To maintain your account and application history</li>
                            <li>To process payments and manage subscriptions</li>
                            <li>To improve the Service through aggregated, anonymized analytics</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">3. Data Processing (AI)</h2>
                        <p>Your CV and profile data is processed by AI language models (Claude by Anthropic) to generate tailored documents. This processing occurs on secure servers. Your data is not used to train AI models. Each request is processed independently and not retained by the AI provider.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Sharing</h2>
                        <p>We share data only with:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Clerk:</strong> Authentication provider</li>
                            <li><strong>Stripe:</strong> Payment processing</li>
                            <li><strong>Anthropic:</strong> AI document generation (data not retained)</li>
                            <li><strong>Job API providers:</strong> We send anonymized queries only (no personal data)</li>
                        </ul>
                        <p className="mt-2">We do not sell your personal data to third parties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">5. Your Rights (GDPR)</h2>
                        <p>Under GDPR, you have the right to:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2">
                            <li><strong>Access:</strong> Export all your data via Settings → Export My Data</li>
                            <li><strong>Rectification:</strong> Edit your profile and preferences at any time</li>
                            <li><strong>Erasure:</strong> Delete your account and all data via Settings → Delete Account</li>
                            <li><strong>Portability:</strong> Download your data in JSON format</li>
                            <li><strong>Objection:</strong> Disable automated processing via Settings → Automation toggle</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Retention</h2>
                        <p>We retain your data for as long as your account is active. Upon account deletion, all personal data is permanently removed within 30 days. Anonymized, aggregated data may be retained for analytics.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Security</h2>
                        <p>We implement industry-standard security measures including encrypted connections (TLS), secure database access, and regular security reviews. All data at rest is encrypted.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
                        <p>We use essential cookies for authentication and session management. We use no third-party tracking cookies. See our cookie consent banner for more details.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to This Policy</h2>
                        <p>We may update this policy periodically. Material changes will be communicated via email. The &quot;last updated&quot; date above reflects the most recent revision.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
                        <p>For privacy inquiries or to exercise your data rights, contact us at <Link href="/contact" className="text-primary underline">our contact page</Link>.</p>
                    </section>
                </div>
            </main>
        </div>
    );
}
