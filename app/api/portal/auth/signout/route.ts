import { NextResponse } from "next/server";
import { deleteCustomerSessionCookie } from "@/lib/customer-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  deleteCustomerSessionCookie(response);
  return response;
}
