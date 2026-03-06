import { ImageResponse } from "next/og";

export const alt = "AutoApply AI — AI-Powered Resume Tailoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
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
                {/* Gradient accent top */}
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

                {/* Glow effects */}
                <div
                    style={{
                        position: "absolute",
                        top: -100,
                        right: -100,
                        width: 400,
                        height: 400,
                        borderRadius: 200,
                        background: "radial-gradient(circle, rgba(37,99,235,0.15), transparent)",
                        display: "flex",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: -80,
                        left: -80,
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent)",
                        display: "flex",
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
                    {/* Logo */}
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
                            <div style={{ color: "white", fontSize: 32, fontWeight: 800 }}>A</div>
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
                            fontSize: 58,
                            fontWeight: 800,
                            lineHeight: 1.1,
                            letterSpacing: -2,
                            marginBottom: 24,
                            display: "flex",
                            flexWrap: "wrap",
                            maxWidth: 900,
                        }}
                    >
                        <span style={{ color: "#FFFFFF" }}>Tailor Your CV for </span>
                        <span
                            style={{
                                background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                backgroundClip: "text",
                                color: "transparent",
                            }}
                        >
                            Every Job
                        </span>
                        <span style={{ color: "#FFFFFF" }}> in 60 Seconds</span>
                    </div>

                    {/* Subtitle */}
                    <div
                        style={{
                            fontSize: 22,
                            color: "#94A3B8",
                            lineHeight: 1.5,
                            maxWidth: 700,
                            display: "flex",
                        }}
                    >
                        AI-powered ATS-optimized resumes and cover letters. 7 job board APIs. Zero fabrication. GDPR compliant.
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 48, marginTop: 48 }}>
                        {[
                            { num: "7", label: "Job APIs" },
                            { num: "100+", label: "ATS Keywords" },
                            { num: "0", label: "Fabricated" },
                            { num: "60s", label: "Per Tailoring" },
                        ].map((stat) => (
                            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div
                                    style={{
                                        fontSize: 36,
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
                                        fontSize: 13,
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
        { ...size }
    );
}
