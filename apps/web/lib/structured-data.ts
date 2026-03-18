import { getLocalizedAbsoluteUrl } from "@/lib/seo";

const ORGANIZATION_ID = "https://autoapply.works/#organization";
const SUPPORT_CONTACT_POINT_ID = "https://autoapply.works/#contact-support";

function buildOrganizationSchema() {
    return {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "AutoApply AI",
        url: "https://autoapply.works",
        logo: "https://autoapply.works/icon.svg",
        email: "support@autoapply.works",
        contactPoint: [
            {
                "@type": "ContactPoint",
                "@id": SUPPORT_CONTACT_POINT_ID,
                contactType: "customer support",
                email: "support@autoapply.works",
                url: "https://autoapply.works/en/contact",
                areaServed: "Worldwide",
                availableLanguage: ["en", "fr", "de", "es", "it"],
            },
        ],
        sameAs: [
            "https://www.linkedin.com/company/autoapply-ai/",
            "https://x.com/autoapplyai",
        ],
    };
}

export function buildTrustPageJsonLd(
    locale: string,
    path: "/contact" | "/privacy" | "/terms",
    pageName: string
) {
    const pageUrl = getLocalizedAbsoluteUrl(locale, path);

    return {
        "@context": "https://schema.org",
        "@graph": [
            buildOrganizationSchema(),
            {
                "@type": "WebPage",
                "@id": `${pageUrl}#webpage`,
                url: pageUrl,
                name: pageName,
                inLanguage: locale,
                about: {
                    "@id": ORGANIZATION_ID,
                },
                primaryImageOfPage: "https://autoapply.works/opengraph-image",
            },
        ],
    };
}
