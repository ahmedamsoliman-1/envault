import { createSuccessResponse } from "@envault/api-contract";

export function GET() {
  return Response.json(
    createSuccessResponse(
      {
        name: "envault-api",
        status: "ok" as const,
        version: "v1" as const,
      },
      crypto.randomUUID(),
    ),
  );
}
