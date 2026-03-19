import { vi } from "vitest";

const mockClerkUsers = {
    createUser: vi.fn(),
    getUserList: vi.fn(),
    verifyPassword: vi.fn(),
};

function patternToRegExp(pattern: string) {
    const escapedPattern = pattern
        .replace(/[.+?^${}|\[\]\\]/g, "\\$&")
        .replace(/:[^/()]+/g, "[^/]+");

    return new RegExp(`^${escapedPattern}$`);
}

// Mock Clerk client-side utilities/components
vi.mock("@clerk/nextjs", () => ({
    ClerkProvider: ({ children }: any) => children,
    SignIn: () => null,
    SignUp: () => null,
    useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: true, userId: "clerk_test_user_123" })),
    useClerk: vi.fn(() => ({ signOut: vi.fn() })),
}));

// Mock Clerk server-side utilities
vi.mock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({ userId: "clerk_test_user_123" })),
    currentUser: vi.fn(async () => ({
        firstName: "Test",
        lastName: "User",
        emailAddresses: [{ emailAddress: "test@example.com" }],
    })),
    clerkClient: vi.fn(async () => ({
        users: mockClerkUsers,
    })),
    clerkMiddleware: vi.fn((handler: any) => handler),
    createRouteMatcher: vi.fn((routes: any) => {
        const routeMatchers = (Array.isArray(routes) ? routes : [routes]).map((route: any) => {
            if (route instanceof RegExp) {
                return (pathname: string) => route.test(pathname);
            }

            if (typeof route === "function") {
                return (_pathname: string, req: any) => route(req);
            }

            const routeRegex = patternToRegExp(String(route));
            return (pathname: string) => routeRegex.test(pathname);
        });

        return (req: any) => {
            const pathname = req?.nextUrl?.pathname || "";
            return routeMatchers.some((matcher: any) => matcher(pathname, req));
        };
    }),
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
        $queryRawUnsafe: vi.fn(),
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
const mockResendSend = vi.fn().mockResolvedValue({ id: "email_123" });
(globalThis as Record<string, unknown>).__mockResendSend = mockResendSend;

vi.mock("resend", () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: mockResendSend,
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
