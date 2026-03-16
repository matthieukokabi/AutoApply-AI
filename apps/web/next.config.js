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
        ];
    },
};

module.exports = withNextIntl(nextConfig);
