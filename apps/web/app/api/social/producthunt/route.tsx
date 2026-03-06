import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Product Hunt gallery: 1270x760px
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const slide = searchParams.get("slide") || "1";

    const slides: Record<string, { title: string; subtitle: string; features: string[] }> = {
        "1": {
            title: "Tailor Your CV for Every Job",
            subtitle: "AI-powered resume and cover letter tailoring in 60 seconds",
            features: [
                "Upload your CV once",
                "AI restructures with ATS keywords",
                "Cover letter from YOUR experience",
                "Clean PDF output",
            ],
        },
        "2": {
            title: "7 Job Board APIs",
            subtitle: "Automatic discovery from official sources every 4 hours",
            features: [
                "Adzuna (Global)",
                "The Muse (US/EU)",
                "Remotive (Remote jobs)",
                "Arbeitnow (EU/DACH)",
                "JSearch (RapidAPI)",
                "Jooble (Global)",
                "Reed (UK)",
            ],
        },
        "3": {
            title: "AI Compatibility Scoring",
            subtitle: "Every job scored 0-100 so you focus on your best matches",
            features: [
                "Skills Match — 40%",
                "Experience Years — 25%",
                "Education Level — 15%",
                "Industry Relevance — 20%",
            ],
        },
        "4": {
            title: "Zero Fabrication Guarantee",
            subtitle: "AI never adds skills or experience you don't have",
            features: [
                "Only reorganizes YOUR real background",
                "Rephrases with ATS keywords",
                "Adjusts emphasis per job",
                "Anti-hallucination guardrails",
            ],
        },
        "5": {
            title: "Track Every Application",
            subtitle: "Kanban dashboard from discovery to offer",
            features: [
                "Discovered → Tailored → Applied",
                "Interview → Offer → Rejected",
                "Drag-and-drop status updates",
                "Weekly digest emails",
            ],
        },
    };

    const current = slides[slide] || slides["1"];

    return new ImageResponse(
        (
            <div
                style={{
                    width: 1270,
                    height: 760,
                    display: "flex",
                    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Gradient top bar */}
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

                {/* Glow */}
                <div
                    style={{
                        position: "absolute",
                        top: -100,
                        right: -100,
                        width: 400,
                        height: 400,
                        borderRadius: 200,
                        background: "radial-gradient(circle, rgba(37,99,235,0.1), transparent)",
                        display: "flex",
                    }}
                />

                {/* Content */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "60px 80px",
                        width: "100%",
                        justifyContent: "center",
                    }}
                >
                    {/* Logo + slide indicator */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <div style={{ color: "white", fontSize: 26, fontWeight: 800 }}>A</div>
                            </div>
                            <div style={{ color: "#64748B", fontSize: 18, fontWeight: 600, letterSpacing: 2 }}>
                                AUTOAPPLY AI
                            </div>
                        </div>

                        {/* Slide dots */}
                        <div style={{ display: "flex", gap: 8 }}>
                            {["1", "2", "3", "4", "5"].map((s) => (
                                <div
                                    key={s}
                                    style={{
                                        width: s === slide ? 24 : 8,
                                        height: 8,
                                        borderRadius: 4,
                                        background: s === slide
                                            ? "linear-gradient(135deg, #2563EB, #7C3AED)"
                                            : "#334155",
                                        display: "flex",
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div
                        style={{
                            fontSize: 52,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            letterSpacing: -2,
                            marginBottom: 16,
                            display: "flex",
                        }}
                    >
                        <span
                            style={{
                                background: "linear-gradient(135deg, #FFFFFF, #E2E8F0)",
                                backgroundClip: "text",
                                color: "transparent",
                            }}
                        >
                            {current.title}
                        </span>
                    </div>

                    {/* Subtitle */}
                    <div style={{ fontSize: 22, color: "#94A3B8", marginBottom: 40, display: "flex" }}>
                        {current.subtitle}
                    </div>

                    {/* Feature list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {current.features.map((f, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
                                        {slide === "2" ? (i + 1).toString() : "✓"}
                                    </div>
                                </div>
                                <div style={{ fontSize: 22, color: "#E2E8F0", fontWeight: 500 }}>
                                    {f}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Domain */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 24,
                        right: 60,
                        fontSize: 16,
                        color: "#475569",
                        display: "flex",
                    }}
                >
                    autoapply.works
                </div>
            </div>
        ),
        { width: 1270, height: 760 }
    );
}
