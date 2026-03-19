import { getLocalizedAbsoluteUrl } from "@/lib/seo";
import {
    OFFICIAL_CONTACT_EMAIL,
    OFFICIAL_LINKEDIN_URL,
    OFFICIAL_X_URL,
} from "@/lib/brand-identity";

const ORGANIZATION_ID = "https://autoapply.works/#organization";
const SUPPORT_CONTACT_POINT_ID = "https://autoapply.works/#contact-support";

function buildOrganizationSchema() {
    return {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "AutoApply AI",
        url: "https://autoapply.works",
        logo: "https://autoapply.works/icon.svg",
        email: OFFICIAL_CONTACT_EMAIL,
        contactPoint: [
            {
                "@type": "ContactPoint",
                "@id": SUPPORT_CONTACT_POINT_ID,
                contactType: "customer support",
                email: OFFICIAL_CONTACT_EMAIL,
                url: "https://autoapply.works/en/contact",
                areaServed: "Worldwide",
                availableLanguage: ["en", "fr", "de", "es", "it"],
            },
        ],
        sameAs: [OFFICIAL_LINKEDIN_URL, OFFICIAL_X_URL],
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
