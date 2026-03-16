import { ImageResponse } from "next/og";
import { OG_IMAGE_CACHE_HEADERS } from "@/lib/og-cache";

export const runtime = "edge";

// LinkedIn company banner: 1128x191px
export async function GET() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 1128,
                    height: 191,
                    display: "flex",
                    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
                    position: "relative",
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {/* Gradient accent top */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        display: "flex",
                        background: "linear-gradient(90deg, #2563EB, #7C3AED, #2563EB)",
                    }}
                />

                {/* Glow */}
                <div
                    style={{
                        position: "absolute",
                        top: -100,
                        left: "20%",
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        background: "radial-gradient(circle, rgba(37,99,235,0.08), transparent)",
                        display: "flex",
                    }}
                />

                {/* Content */}
                <div style={{ display: "flex", alignItems: "center", gap: 32, padding: "0 60px" }}>
                    {/* Logo */}
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ color: "white", fontSize: 28, fontWeight: 800 }}>A</div>
                    </div>

                    {/* Name + tagline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: -0.5 }}>
                            AutoApply AI
                        </div>
                        <div style={{ fontSize: 14, color: "#64748B" }}>
                            AI-Tailored CVs & Cover Letters | ATS-Optimized | 7 Job APIs | Zero Fabrication
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 20, marginLeft: "auto" }}>
                        {[
                            { n: "7", l: "APIs" },
                            { n: "60s", l: "Tailoring" },
                            { n: "0", l: "Fabricated" },
                        ].map((s) => (
                            <div key={s.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                                <span
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 800,
                                        background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                        backgroundClip: "text",
                                        color: "transparent",
                                    }}
                                >
                                    {s.n}
                                </span>
                                <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                                    {s.l}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Domain */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 8,
                        right: 24,
                        fontSize: 11,
                        color: "#334155",
                        display: "flex",
                    }}
                >
                    autoapply.works
                </div>
            </div>
        ),
        { width: 1128, height: 191, headers: OG_IMAGE_CACHE_HEADERS }
    );
}
