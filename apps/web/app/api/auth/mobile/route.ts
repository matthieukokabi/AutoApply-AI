import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { createMobileToken } from '@/lib/mobile-auth';
import { getClientIp, isRateLimited } from '@/lib/rate-limit';

const MOBILE_AUTH_RATE_LIMIT_MAX_REQUESTS = 10;
const MOBILE_AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const mobileAuthRequestLog = new Map<string, number[]>();

/**
 * POST /api/auth/mobile
 * Mobile sign-in and sign-up endpoint.
 * Uses Clerk Backend API to verify credentials and returns a custom JWT.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, action = 'sign-in' } = body;
    const clientIp = getClientIp(req);

    if (
      clientIp &&
      isRateLimited({
        store: mobileAuthRequestLog,
        key: clientIp,
        maxRequests: MOBILE_AUTH_RATE_LIMIT_MAX_REQUESTS,
        windowMs: MOBILE_AUTH_RATE_LIMIT_WINDOW_MS,
      })
    ) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again shortly.' },
        { status: 429 }
      );
    }

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!process.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY is required for /api/auth/mobile');
      return NextResponse.json(
        { error: 'Mobile auth endpoint misconfigured' },
        { status: 503 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const requestedAction = action === 'sign-up' ? 'sign-up' : 'sign-in';
    const client = await clerkClient();

    if (requestedAction === 'sign-up') {
      // Create a new user via Clerk Backend API
      try {
        const user = await client.users.createUser({
          emailAddress: [normalizedEmail],
          password,
        });

        const token = await createMobileToken(user.id, normalizedEmail);
        return NextResponse.json({ token, userId: user.id, email: normalizedEmail });
      } catch (err: any) {
        const message = err?.errors?.[0]?.message || 'Failed to create account';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Sign in flow
    // 1. Find user by email
    const users = await client.users.getUserList({
      emailAddress: [normalizedEmail],
    });

    const userList = Array.isArray(users) ? users : (users as any)?.data || [];

    if (userList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = userList[0];

    // 2. Verify password via Clerk Backend API
    try {
      await client.users.verifyPassword({
        userId: user.id,
        password,
      });
    } catch {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 3. Create mobile JWT
    const token = await createMobileToken(user.id, normalizedEmail);

    return NextResponse.json({
      token,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress || normalizedEmail,
    });
  } catch (error) {
    console.error('[Mobile Auth Error]', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
