import type { Metadata } from "next";
import ContactPageClient from "./contact-page-client";
import { buildCanonicalOgParity } from "@/lib/seo";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Contact Us — AutoApply AI";
    const description =
        "Contact AutoApply AI support for onboarding, billing, and product questions.";
    const parity = buildCanonicalOgParity(locale, "/contact");

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

export default function ContactPage() {
    return <ContactPageClient />;
}
