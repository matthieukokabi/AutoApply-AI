const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const CONTENT_SECURITY_POLICY = [
    "default-src 'self' https: data: blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "form-action 'self' https:",
    "upgrade-insecure-requests",
]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();

const SECURITY_HEADERS = [
    {
        key: "Content-Security-Policy",
        value: CONTENT_SECURITY_POLICY,
    },
    {
        key: "X-Frame-Options",
        value: "DENY",
    },
    {
        key: "X-Content-Type-Options",
        value: "nosniff",
    },
    {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
    },
];

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
            {
                source: "/campaign/:path*",
                destination: "/en/campaign/:path*",
                permanent: false,
            },
            {
                source: "/sign-in",
                destination: "/en/sign-in",
                permanent: false,
            },
            {
                source: "/sign-in/:path*",
                destination: "/en/sign-in/:path*",
                permanent: false,
            },
            {
                source: "/sign-up",
                destination: "/en/sign-up",
                permanent: false,
            },
            {
                source: "/sign-up/:path*",
                destination: "/en/sign-up/:path*",
                permanent: false,
            },
        ];
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: SECURITY_HEADERS,
            },
        ];
    },
};

module.exports = withNextIntl(nextConfig);
