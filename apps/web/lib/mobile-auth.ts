import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error('CLERK_SECRET_KEY not set');
  return new TextEncoder().encode(key);
};

/**
 * Create a JWT for mobile app authentication.
 * Signs with CLERK_SECRET_KEY using HS256.
 */
export async function createMobileToken(userId: string, email: string) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .setIssuer('autoapply-mobile')
    .sign(getSecret());
}

/**
 * Verify a mobile JWT token and extract userId + email.
 * Returns null if token is invalid or expired.
 */
export async function verifyMobileToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'autoapply-mobile',
    });
    return { userId: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}
