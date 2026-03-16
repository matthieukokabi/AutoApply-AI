const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "img.clerk.com",
            },
        ],
    },
    async redirects() {
        return [
            {
                source: "/",
                destination: "/en",
                permanent: false,
            },
            {
                source: "/blog",
                destination: "/en/blog",
                permanent: false,
            },
            {
                source: "/blog/:path*",
                destination: "/en/blog/:path*",
                permanent: false,
            },
            {
                source: "/terms",
                destination: "/en/terms",
                permanent: false,
            },
            {
                source: "/privacy",
                destination: "/en/privacy",
                permanent: false,
            },
            {
                source: "/contact",
                destination: "/en/contact",
                permanent: false,
            },
            {
                source: "/roadmap",
                destination: "/en/roadmap",
                permanent: false,
            },
            {
                source: "/auth-diagnostics",
                destination: "/en/auth-diagnostics",
                permanent: false,
            },
        ];
    },
};

module.exports = withNextIntl(nextConfig);
