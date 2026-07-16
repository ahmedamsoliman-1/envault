import "server-only";

import type { NextRequest } from "next/server";

export function getPasskeyConfiguration(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const origin = requestOrigin
    ? new URL(requestOrigin).origin
    : request.nextUrl.origin;
  return {
    origin,
    rpId: new URL(origin).hostname,
    rpName: process.env.NEXT_PUBLIC_APP_NAME ?? "Envault",
  };
}
