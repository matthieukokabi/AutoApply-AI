import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Create your account
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Start tailoring your CV with AI in minutes
                    </p>
                </div>
                <SignUp
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
