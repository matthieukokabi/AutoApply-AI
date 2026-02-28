import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Welcome back
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Sign in to your AutoApply AI account
                    </p>
                </div>
                <SignIn
                    afterSignInUrl="/dashboard"
                    signUpUrl="/sign-up"
                    appearance={{
                        elements: {
                            rootBox: "mx-auto w-full",
                            card: "shadow-xl rounded-xl",
                            socialButtonsBlockButton:
                                "border border-slate-200 hover:bg-slate-50",
                            formButtonPrimary:
                                "bg-blue-600 hover:bg-blue-700 text-sm",
                            footerActionLink:
                                "text-blue-600 hover:text-blue-700",
                        },
                    }}
                />
            </div>
        </div>
    );
}
