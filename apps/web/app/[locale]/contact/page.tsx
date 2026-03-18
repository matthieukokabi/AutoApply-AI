import type { Metadata } from "next";
import ContactPageClient from "./contact-page-client";
import { buildCanonicalOgParity } from "@/lib/seo";
import { buildTrustPageJsonLd } from "@/lib/structured-data";

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

export default async function ContactPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const jsonLd = buildTrustPageJsonLd(
        locale,
        "/contact",
        "Contact Us — AutoApply AI"
    );

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ContactPageClient />
        </>
    );
}
