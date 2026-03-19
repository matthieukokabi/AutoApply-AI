"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryMessages {
    title: string;
    description: string;
    refresh: string;
}

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    messages?: Partial<ErrorBoundaryMessages>;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            const messages: ErrorBoundaryMessages = {
                title: this.props.messages?.title ?? "Something went wrong",
                description:
                    this.props.messages?.description ??
                    "An unexpected error occurred. Please try refreshing the page.",
                refresh: this.props.messages?.refresh ?? "Refresh Page",
            };

            return (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{messages.title}</h2>
                    <p className="text-muted-foreground mb-4 max-w-md">
                        {messages.description}
                    </p>
                    <Button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                    >
                        {messages.refresh}
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

interface LocalizedErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export function LocalizedErrorBoundary({
    children,
    fallback,
}: LocalizedErrorBoundaryProps) {
    const t = useTranslations("errorBoundary");

    return (
        <ErrorBoundary
            fallback={fallback}
            messages={{
                title: t("title"),
                description: t("description"),
                refresh: t("refresh"),
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
