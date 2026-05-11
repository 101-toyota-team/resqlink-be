import { JwtPayload } from "../types";
import { ERROR_MESSAGES } from "./constants";

export function getRoleFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata === "object" && metadata !== null) {
    const role = (metadata as Record<string, unknown>).role;
    if (typeof role === "string") {
      return role;
    }
  }
  return undefined;
}

export function isDriverRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return payload.role === "driver" || metadataRole === "driver";
}

export function canAccessBooking(
  payload: JwtPayload,
  bookingUserId: string | undefined,
): boolean {
  return bookingUserId === payload.sub || isDriverRole(payload);
}

export function unauthorizedResponse() {
  return { error: ERROR_MESSAGES.FORBIDDEN_ACCESS };
}
