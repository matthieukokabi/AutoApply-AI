import { ImageResponse } from "next/og";
import { OG_IMAGE_CACHE_HEADERS } from "@/lib/og-cache";

export const runtime = "edge";

// Profile picture: 512x512px (works for Twitter, LinkedIn, ProductHunt)
export async function GET() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 512,
                    height: 512,
                    display: "flex",
                    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Subtle glow */}
                <div
                    style={{
                        position: "absolute",
                        top: -50,
                        right: -50,
                        width: 250,
                        height: 250,
                        borderRadius: 125,
                        background: "radial-gradient(circle, rgba(255,255,255,0.15), transparent)",
                        display: "flex",
                    }}
                />

                {/* Main letter */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <div
                        style={{
                            fontSize: 220,
                            fontWeight: 800,
                            color: "white",
                            lineHeight: 1,
                            letterSpacing: -8,
                        }}
                    >
                        A
                    </div>
                    <div
                        style={{
                            width: 100,
                            height: 6,
                            borderRadius: 3,
                            background: "rgba(255,255,255,0.5)",
                            display: "flex",
                        }}
                    />
                    <div
                        style={{
                            fontSize: 24,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.7)",
                            letterSpacing: 8,
                            textTransform: "uppercase" as const,
                            marginTop: 4,
                        }}
                    >
                        AI
                    </div>
                </div>
            </div>
        ),
        { width: 512, height: 512, headers: OG_IMAGE_CACHE_HEADERS }
    );
}
