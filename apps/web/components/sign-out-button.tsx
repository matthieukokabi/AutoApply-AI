"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type SignOutButtonProps = {
    label?: string;
};

export function SignOutButton({ label = "Sign out" }: SignOutButtonProps) {
    const { signOut } = useClerk();
    const router = useRouter();

    return (
        <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => signOut(() => router.push("/"))}
        >
            <LogOut className="h-4 w-4" />
            {label}
        </Button>
    );
}
