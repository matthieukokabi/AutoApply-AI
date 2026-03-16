import { vi } from "vitest";

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
    auth: vi.fn(() => ({ userId: "clerk_test_user_123" })),
    currentUser: vi.fn(() => ({
        firstName: "Test",
        lastName: "User",
        emailAddresses: [{ emailAddress: "test@example.com" }],
    })),
    authMiddleware: vi.fn(() => (req: any, res: any, next: any) => next?.()),
    ClerkProvider: ({ children }: any) => children,
    SignIn: () => null,
    SignUp: () => null,
    clerkClient: {
        users: {
            createUser: vi.fn(),
            getUserList: vi.fn(),
            verifyPassword: vi.fn(),
        },
    },
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
            delete: vi.fn(),
        },
        masterProfile: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        jobPreferences: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        application: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            count: vi.fn(),
            aggregate: vi.fn(),
            groupBy: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        },
        job: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        workflowError: {
            create: vi.fn(),
        },
        stripeWebhookEvent: {
            create: vi.fn(),
            delete: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

// Mock auth helper (used by onboarding route)
vi.mock("@/lib/auth", () => ({
    getAuthUser: vi.fn(),
}));

// Mock utils (APPLICATION_STATUSES used by applications/[id] route)
vi.mock("@/lib/utils", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/utils")>();
    return {
        ...actual,
    };
});

// Mock email service
vi.mock("@/lib/email", () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendJobMatchEmail: vi.fn().mockResolvedValue(undefined),
    sendTailoringCompleteEmail: vi.fn().mockResolvedValue(undefined),
    sendWeeklyDigestEmail: vi.fn().mockResolvedValue(undefined),
    sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock mobile auth
vi.mock("@/lib/mobile-auth", () => ({
    createMobileToken: vi.fn().mockResolvedValue("mock_jwt_token_123"),
    verifyMobileToken: vi.fn().mockResolvedValue(null),
}));

// Mock Resend (for contact route)
vi.mock("resend", () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: vi.fn().mockResolvedValue({ id: "email_123" }),
        },
    })),
}));

// Mock next/headers (for stripe webhook)
vi.mock("next/headers", () => ({
    headers: vi.fn(() => ({
        get: vi.fn((name: string) => {
            if (name === "Stripe-Signature") return "test_stripe_signature";
            return null;
        }),
    })),
}));

// Mock global fetch for n8n webhook calls
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => "",
}));

// Mock Stripe
vi.mock("@/lib/stripe", () => ({
    stripe: {
        checkout: {
            sessions: {
                create: vi.fn(),
            },
        },
        webhooks: {
            constructEvent: vi.fn(),
        },
        subscriptions: {
            retrieve: vi.fn(),
        },
    },
    PLANS: {
        free: { name: "Free", credits: 3, price: 0 },
        pro: {
            name: "Pro",
            credits: 50,
            monthlyPriceId: "price_pro_monthly",
            yearlyPriceId: "price_pro_yearly",
        },
        unlimited: {
            name: "Unlimited",
            credits: Infinity,
            monthlyPriceId: "price_unlimited",
        },
        credit_pack: {
            name: "Credit Pack",
            credits: 10,
            priceId: "price_credit_pack",
        },
    },
}));
