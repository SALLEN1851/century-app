// src/middleware.ts
export { auth as middleware } from "@/auth-edge";

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
