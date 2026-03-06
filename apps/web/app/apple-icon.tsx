import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 180,
                    height: 180,
                    borderRadius: 36,
                    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                    }}
                >
                    <div
                        style={{
                            color: "white",
                            fontSize: 72,
                            fontWeight: 800,
                            lineHeight: 1,
                            letterSpacing: -2,
                        }}
                    >
                        A
                    </div>
                    <div
                        style={{
                            width: 50,
                            height: 4,
                            borderRadius: 2,
                            background: "rgba(255,255,255,0.6)",
                        }}
                    />
                </div>
            </div>
        ),
        { ...size }
    );
}
