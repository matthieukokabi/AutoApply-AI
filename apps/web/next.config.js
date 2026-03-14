const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "img.clerk.com",
            },
        ],
    },
    async rewrites() {
        return [
            {
                // Clerk proxy: routes Clerk API requests through your own domain
                // to avoid third-party cookie blocking in Arc, Brave, Safari, etc.
                source: "/__clerk/:path*",
                destination: "https://clerk.autoapply.works/:path*",
            },
        ];
    },
};

module.exports = withNextIntl(nextConfig);
