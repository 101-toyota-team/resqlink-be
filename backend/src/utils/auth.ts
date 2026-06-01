import { JwtPayload } from "../types";

export function getRoleFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata === "object" && metadata !== null) {
    const role = (metadata as Record<string, unknown>).role;
    if (typeof role === "string") {
      return role;
    }
  }
  return undefined;
}

export function isProviderRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return payload.role === "provider" || metadataRole === "provider";
}

export function isAdminRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return payload.role === "admin" || metadataRole === "admin";
}

export function getProviderId(payload: JwtPayload): string | undefined {
  if (payload.app_metadata && typeof payload.app_metadata === "object") {
    const providerId = (payload.app_metadata as Record<string, unknown>)
      .provider_id;
    if (typeof providerId === "string") {
      return providerId;
    }
  }

  if (typeof payload.provider_id === "string") {
    return payload.provider_id;
  }

  return undefined;
}

export function isDriverRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return payload.role === "driver" || metadataRole === "driver";
}

export function canAccessBooking(
  payload: JwtPayload,
  bookingUserId?: string,
  bookingProviderId?: string,
): boolean {
  if (isAdminRole(payload)) return true;
  if (bookingUserId && bookingUserId === payload.sub) return true;

  if (isProviderRole(payload) && bookingProviderId) {
    return getProviderId(payload) === bookingProviderId;
  }

  return false;
}
