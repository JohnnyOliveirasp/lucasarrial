/**
 * Respostas JSON padronizadas pras rotas /api/v1/*.
 */
import { NextResponse } from "next/server";

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  const body: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

export function unauthorized() {
  return jsonError("unauthorized", "Missing or invalid credentials", 401);
}

export function forbidden(message = "Forbidden") {
  return jsonError("forbidden", message, 403);
}

export function notFound(resource = "Resource") {
  return jsonError("not_found", `${resource} not found`, 404);
}

export function badRequest(message: string, details?: unknown) {
  return jsonError("bad_request", message, 400, details);
}

export function serverError(message = "Internal error") {
  return jsonError("server_error", message, 500);
}
