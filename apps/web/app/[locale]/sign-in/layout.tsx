import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default function SignInLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <head>
                <link rel="preconnect" href="https://clerk.autoapply.works" />
                <link rel="dns-prefetch" href="https://clerk.autoapply.works" />
                <link rel="preconnect" href="https://api.clerk.com" crossOrigin="" />
                <link rel="dns-prefetch" href="https://api.clerk.com" />
            </head>
            <ClerkProvider>{children}</ClerkProvider>
        </>
    );
}
