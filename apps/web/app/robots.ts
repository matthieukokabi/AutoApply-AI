import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://autoapply-ai.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/dashboard", "/*/dashboard", "/onboarding", "/*/onboarding", "/profile", "/*/profile", "/settings", "/*/settings", "/jobs", "/*/jobs", "/documents/", "/*/documents/"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
