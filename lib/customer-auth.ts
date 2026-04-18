import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export type CustomerPayload = {
  id: string;
  email: string;
  name: string;
};

const COOKIE_NAME = "customer-session";
const EXPIRY = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createCustomerSession(customer: CustomerPayload): Promise<string> {
  return new SignJWT({ id: customer.id, email: customer.email, name: customer.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(EXPIRY)
    .setIssuedAt()
    .sign(getSecret());
}

export async function getCustomerSession(req: NextRequest): Promise<CustomerPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as CustomerPayload;
  } catch {
    return null;
  }
}

export async function getCustomerSessionFromCookies(): Promise<CustomerPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as CustomerPayload;
  } catch {
    return null;
  }
}

export function setCustomerSessionCookie(
  response: Response,
  jwt: string
): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`
  );
}

export function deleteCustomerSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}
