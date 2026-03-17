import type { Metadata } from "next";
import ContactPageClient from "./contact-page-client";
import { buildLocaleAlternates } from "@/lib/seo";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;

    return {
        title: "Contact Us — AutoApply AI",
        description:
            "Contact AutoApply AI support for onboarding, billing, and product questions.",
        alternates: buildLocaleAlternates(locale, "/contact"),
    };
}

export default function ContactPage() {
    return <ContactPageClient />;
}
