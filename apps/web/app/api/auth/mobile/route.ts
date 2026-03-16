import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { createMobileToken } from '@/lib/mobile-auth';

const MOBILE_AUTH_RATE_LIMIT_MAX_REQUESTS = 10;
const MOBILE_AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const mobileAuthRequestLog = new Map<string, number[]>();

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null;
}

function isRateLimited(clientIp: string, now = Date.now()): boolean {
  const windowStart = now - MOBILE_AUTH_RATE_LIMIT_WINDOW_MS;
  const recentRequests = (mobileAuthRequestLog.get(clientIp) || []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recentRequests.length >= MOBILE_AUTH_RATE_LIMIT_MAX_REQUESTS) {
    mobileAuthRequestLog.set(clientIp, recentRequests);
    return true;
  }

  recentRequests.push(now);
  mobileAuthRequestLog.set(clientIp, recentRequests);
  return false;
}

/**
 * POST /api/auth/mobile
 * Mobile sign-in and sign-up endpoint.
 * Uses Clerk Backend API to verify credentials and returns a custom JWT.
 */
export async function POST(req: Request) {
  try {
    const client = await clerkClient();
    const body = await req.json();
    const { email, password, action = 'sign-in' } = body;
    const clientIp = getClientIp(req);

    if (clientIp && isRateLimited(clientIp)) {
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

    const normalizedEmail = email.trim().toLowerCase();
    const requestedAction = action === 'sign-up' ? 'sign-up' : 'sign-in';

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
