import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  // --- Admin guard ---
  const isLoggedIn = !!req.auth;
  if (req.nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // --- Portal guard ---
  const portalPublic = ["/portal/signin", "/portal/register"];
  const isPortalPublicPath =
    portalPublic.includes(req.nextUrl.pathname) ||
    req.nextUrl.pathname.startsWith("/portal/reset-password");

  if (req.nextUrl.pathname.startsWith("/portal") && !isPortalPublicPath) {
    const customer = await getCustomerSession(req);
    if (!customer) {
      const url = new URL("/portal/signin", req.nextUrl.origin);
      url.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
