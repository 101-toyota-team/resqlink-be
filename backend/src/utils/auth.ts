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

export function isDriverRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return metadataRole === "driver";
}

export function isProviderRole(payload: JwtPayload): boolean {
  const metadataRole = getRoleFromMetadata(payload.app_metadata);
  return metadataRole === "provider";
}

export function getProviderId(payload: JwtPayload): string | undefined {
  if (payload.app_metadata && typeof payload.app_metadata === "object") {
    const providerId = (payload.app_metadata as Record<string, unknown>)
      .provider_id;
    if (typeof providerId === "string") {
      return providerId;
    }
  }

  return undefined;
}

export function canAccessBooking(
  payload: JwtPayload,
  bookingUserId: string | undefined,
  bookingProviderId?: string | undefined,
): boolean {
  if (bookingUserId && bookingUserId === payload.sub) return true;
  if ((isProviderRole(payload) || isDriverRole(payload)) && bookingProviderId) {
    return getProviderId(payload) === bookingProviderId;
  }
  return false;
}
