const crypto = require("crypto");
const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");
const {
    buildGaBootstrapScript,
    buildGtmBootstrapScript,
} = require("./lib/analytics-inline-scripts");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function toCspHash(scriptContent) {
    const hash = crypto
        .createHash("sha256")
        .update(scriptContent)
        .digest("base64");

    return `'sha256-${hash}'`;
}

function getAnalyticsInlineScriptHashes() {
    const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

    if (gtmId) {
        return [toCspHash(buildGtmBootstrapScript(gtmId))];
    }

    if (gaMeasurementId) {
        return [toCspHash(buildGaBootstrapScript(gaMeasurementId))];
    }

    return [];
}

const analyticsInlineScriptHashes = getAnalyticsInlineScriptHashes();
const ENFORCED_SCRIPT_SRC = [
    "'self'",
    "'unsafe-inline'",
    "https:",
].join(" ");
const STRICT_REPORT_ONLY_SCRIPT_SRC = [
    "'self'",
    ...analyticsInlineScriptHashes,
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://challenges.cloudflare.com",
    "https://clerk.autoapply.works",
].join(" ");

const CONTENT_SECURITY_POLICY = [
    "default-src 'self' https: data: blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${ENFORCED_SCRIPT_SRC}`,
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

const STRICT_CSP_REPORT_ONLY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${STRICT_REPORT_ONLY_SCRIPT_SRC}`,
    "style-src 'self' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.clerk.com https://clerk.autoapply.works https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://checkout.stripe.com https://api.stripe.com",
    "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
    "worker-src 'self' blob:",
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
        key: "Content-Security-Policy-Report-Only",
        value: STRICT_CSP_REPORT_ONLY,
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
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
    },
    {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin-allow-popups",
    },
    {
        key: "Cross-Origin-Resource-Policy",
        value: "same-site",
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
                source: "/coming-soon",
                destination: "/en/coming-soon",
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
