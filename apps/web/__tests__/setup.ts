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
}));

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
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
            count: vi.fn(),
            aggregate: vi.fn(),
            groupBy: vi.fn(),
            update: vi.fn(),
        },
        job: {
            findMany: vi.fn(),
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
