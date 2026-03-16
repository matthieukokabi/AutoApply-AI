import { ImageResponse } from "next/og";
import { OG_IMAGE_CACHE_HEADERS } from "@/lib/og-cache";

export const runtime = "edge";

// Twitter header: 1500x500px
export async function GET() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 1500,
                    height: 500,
                    display: "flex",
                    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #0F172A 100%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Gradient accent top */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        display: "flex",
                        background: "linear-gradient(90deg, #2563EB, #7C3AED, #2563EB)",
                    }}
                />

                {/* Glow */}
                <div
                    style={{
                        position: "absolute",
                        top: -200,
                        left: "30%",
                        width: 600,
                        height: 600,
                        borderRadius: 300,
                        background: "radial-gradient(circle, rgba(37,99,235,0.08), transparent)",
                        display: "flex",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: -200,
                        right: "20%",
                        width: 500,
                        height: 500,
                        borderRadius: 250,
                        background: "radial-gradient(circle, rgba(124,58,237,0.06), transparent)",
                        display: "flex",
                    }}
                />

                {/* Content centered */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        gap: 60,
                    }}
                >
                    {/* Left: Logo + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <div
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 16,
                                background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <div style={{ color: "white", fontSize: 42, fontWeight: 800 }}>A</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <div
                                style={{
                                    fontSize: 40,
                                    fontWeight: 800,
                                    color: "white",
                                    letterSpacing: -1,
                                }}
                            >
                                AutoApply AI
                            </div>
                            <div style={{ fontSize: 18, color: "#64748B" }}>
                                autoapply.works
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div
                        style={{
                            width: 2,
                            height: 80,
                            background: "linear-gradient(180deg, transparent, #334155, transparent)",
                            display: "flex",
                        }}
                    />

                    {/* Right: Tagline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
                        <div
                            style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: "#E2E8F0",
                                lineHeight: 1.3,
                            }}
                        >
                            AI-Tailored CVs & Cover Letters
                        </div>
                        <div style={{ fontSize: 18, color: "#64748B", lineHeight: 1.4 }}>
                            ATS-optimized. 7 job APIs. Zero fabrication.
                        </div>
                        {/* Mini stats */}
                        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
                            {[
                                { n: "7", l: "APIs" },
                                { n: "100+", l: "Keywords" },
                                { n: "60s", l: "Tailoring" },
                            ].map((s) => (
                                <div key={s.l} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                    <span
                                        style={{
                                            fontSize: 22,
                                            fontWeight: 800,
                                            background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                            backgroundClip: "text",
                                            color: "transparent",
                                        }}
                                    >
                                        {s.n}
                                    </span>
                                    <span style={{ fontSize: 12, color: "#475569", textTransform: "uppercase" as const }}>
                                        {s.l}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        ),
        { width: 1500, height: 500, headers: OG_IMAGE_CACHE_HEADERS }
    );
}
