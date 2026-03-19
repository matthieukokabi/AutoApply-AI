import type { Metadata } from "next";
import ContactPageClient from "./contact-page-client";
import { buildCanonicalOgParity } from "@/lib/seo";
import { buildTrustPageJsonLd } from "@/lib/structured-data";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
        locale,
        namespace: "contactPage.metadata",
    });
    const title = t("title");
    const description = t("description");
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
    setRequestLocale(locale);
    const t = await getTranslations({
        locale,
        namespace: "contactPage.metadata",
    });
    const jsonLd = buildTrustPageJsonLd(
        locale,
        "/contact",
        t("title")
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
