import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkLocalization } from "@/lib/clerk-localization";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function SignUpLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    return (
        <ClerkProvider localization={getClerkLocalization(locale)}>
            {children}
        </ClerkProvider>
    );
}
