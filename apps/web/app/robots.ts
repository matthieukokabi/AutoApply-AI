import { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = getAppBaseUrl();

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
