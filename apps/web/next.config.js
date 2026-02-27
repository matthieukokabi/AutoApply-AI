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
                source: "/__clerk/:path*",
                destination: "https://frontend-api.clerk.services/:path*",
            },
        ];
    },
};

module.exports = nextConfig;
