import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { OG_IMAGE_CACHE_HEADERS } from "@/lib/og-cache";

export const runtime = "edge";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const title = searchParams.get("title") || "AutoApply AI";
    const subtitle =
        searchParams.get("subtitle") ||
        "Stop writing cover letters. Start getting interviews.";

    return new ImageResponse(
        (
            <div
                style={{
                    width: 1200,
                    height: 630,
                    display: "flex",
                    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Background pattern */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        opacity: 0.05,
                        background:
                            "radial-gradient(circle at 25% 25%, #2563EB 0%, transparent 50%), radial-gradient(circle at 75% 75%, #7C3AED 0%, transparent 50%)",
                    }}
                />

                {/* Gradient accent line top */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        display: "flex",
                        background: "linear-gradient(90deg, #2563EB, #7C3AED, #2563EB)",
                    }}
                />

                {/* Main content */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "60px 80px",
                        width: "100%",
                    }}
                >
                    {/* Logo area */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            marginBottom: 40,
                        }}
                    >
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <div
                                style={{
                                    color: "white",
                                    fontSize: 32,
                                    fontWeight: 800,
                                }}
                            >
                                A
                            </div>
                        </div>
                        <div
                            style={{
                                color: "#94A3B8",
                                fontSize: 24,
                                fontWeight: 600,
                                letterSpacing: 2,
                                textTransform: "uppercase" as const,
                            }}
                        >
                            AutoApply AI
                        </div>
                    </div>

                    {/* Title */}
                    <div
                        style={{
                            fontSize: 56,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            letterSpacing: -1,
                            marginBottom: 24,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <span
                            style={{
                                background: "linear-gradient(135deg, #FFFFFF, #E2E8F0)",
                                backgroundClip: "text",
                                color: "transparent",
                            }}
                        >
                            {title}
                        </span>
                    </div>

                    {/* Subtitle */}
                    <div
                        style={{
                            fontSize: 24,
                            color: "#94A3B8",
                            lineHeight: 1.5,
                            maxWidth: 700,
                            display: "flex",
                        }}
                    >
                        {subtitle}
                    </div>

                    {/* Stats bar */}
                    <div
                        style={{
                            display: "flex",
                            gap: 40,
                            marginTop: 48,
                        }}
                    >
                        {[
                            { num: "7", label: "Job APIs" },
                            { num: "100+", label: "ATS Keywords" },
                            { num: "0", label: "Fabricated" },
                            { num: "60s", label: "Per Tailoring" },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 32,
                                        fontWeight: 800,
                                        background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                        backgroundClip: "text",
                                        color: "transparent",
                                    }}
                                >
                                    {stat.num}
                                </div>
                                <div
                                    style={{
                                        fontSize: 14,
                                        color: "#64748B",
                                        textTransform: "uppercase" as const,
                                        letterSpacing: 1,
                                    }}
                                >
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side decorative element */}
                <div
                    style={{
                        position: "absolute",
                        right: 60,
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        opacity: 0.15,
                    }}
                >
                    {/* Stylized document */}
                    <div
                        style={{
                            width: 200,
                            height: 260,
                            borderRadius: 12,
                            border: "2px solid #2563EB",
                            display: "flex",
                            flexDirection: "column",
                            padding: 20,
                            gap: 8,
                        }}
                    >
                        <div style={{ width: 120, height: 8, borderRadius: 4, background: "#2563EB", display: "flex" }} />
                        <div style={{ width: 160, height: 6, borderRadius: 3, background: "#475569", display: "flex" }} />
                        <div style={{ width: 140, height: 6, borderRadius: 3, background: "#475569", display: "flex" }} />
                        <div style={{ width: 100, height: 6, borderRadius: 3, background: "#475569", display: "flex" }} />
                        <div style={{ width: 160, height: 6, borderRadius: 3, background: "#475569", marginTop: 8, display: "flex" }} />
                        <div style={{ width: 120, height: 6, borderRadius: 3, background: "#475569", display: "flex" }} />
                    </div>
                </div>

                {/* Domain */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 30,
                        right: 80,
                        fontSize: 18,
                        color: "#475569",
                        display: "flex",
                    }}
                >
                    autoapply.works
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            headers: OG_IMAGE_CACHE_HEADERS,
        }
    );
}
