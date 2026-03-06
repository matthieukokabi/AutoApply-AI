import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        color: "white",
                        fontSize: 18,
                        fontWeight: 800,
                        lineHeight: 1,
                    }}
                >
                    A
                </div>
            </div>
        ),
        { ...size }
    );
}
