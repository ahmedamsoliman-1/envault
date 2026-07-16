import {
  createErrorResponse,
  createSuccessResponse,
  type ApiError,
} from "@envault/api-contract";

export function successResponse<T>(data: T, requestId: string, status = 200) {
  return Response.json(createSuccessResponse(data, requestId), { status });
}

export function errorResponse(
  error: ApiError,
  requestId: string,
  status: number,
) {
  return Response.json(createErrorResponse(error, requestId), { status });
}

export function invalidRequestResponse(requestId: string) {
  return errorResponse(
    { code: "INVALID_REQUEST", message: "The request is invalid." },
    requestId,
    400,
  );
}
