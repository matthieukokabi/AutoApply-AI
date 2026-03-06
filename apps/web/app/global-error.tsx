"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                    <div style={{ textAlign: "center", maxWidth: "28rem" }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
                            Something went wrong
                        </h1>
                        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
                            An unexpected error occurred. Please try again.
                        </p>
                        <button
                            onClick={reset}
                            style={{
                                padding: "0.5rem 1.5rem",
                                backgroundColor: "#2563eb",
                                color: "white",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
