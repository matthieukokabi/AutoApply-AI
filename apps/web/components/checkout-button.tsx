"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CheckoutButtonProps {
    plan: "pro_monthly" | "pro_yearly" | "unlimited" | "credit_pack";
    children: React.ReactNode;
    variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
    className?: string;
}

export function CheckoutButton({ plan, children, variant = "default", className }: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);

    async function handleCheckout() {
        setLoading(true);
        try {
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || "Failed to start checkout");
            }
        } catch {
            alert("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button
            variant={variant}
            className={className}
            onClick={handleCheckout}
            disabled={loading}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {children}
        </Button>
    );
}
