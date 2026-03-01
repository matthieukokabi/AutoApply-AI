import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs';
import { createMobileToken } from '@/lib/mobile-auth';

/**
 * POST /api/auth/mobile
 * Mobile sign-in and sign-up endpoint.
 * Uses Clerk Backend API to verify credentials and returns a custom JWT.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, action = 'sign-in' } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (action === 'sign-up') {
      // Create a new user via Clerk Backend API
      try {
        const user = await clerkClient.users.createUser({
          emailAddress: [email],
          password,
        });

        const token = await createMobileToken(user.id, email);
        return NextResponse.json({ token, userId: user.id, email });
      } catch (err: any) {
        const message = err?.errors?.[0]?.message || 'Failed to create account';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // Sign in flow
    // 1. Find user by email
    const users = await clerkClient.users.getUserList({
      emailAddress: [email],
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
      await clerkClient.users.verifyPassword({
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
    const token = await createMobileToken(user.id, email);

    return NextResponse.json({
      token,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress || email,
    });
  } catch (error) {
    console.error('[Mobile Auth Error]', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
