/**
 * @deprecated Import focused interfaces from domain-specific modules:
 *   - IBookingRepository  from "./booking"
 *   - IAmbulanceRepository from "./ambulance"
 *   - IProviderRepository  from "./provider"
 *   - IHospitalRepository  from "./hospital"
 *   - IRealtimeBroadcaster from "./realtime"
 *
 * IPersistenceRepository is kept for backward compatibility but new code
 * should depend on the narrower interfaces.
 */
export { IBookingRepository } from "./booking";
export { IAmbulanceRepository } from "./ambulance";
export { IProviderRepository } from "./provider";
export { IHospitalRepository } from "./hospital";
export { IRealtimeBroadcaster } from "./realtime";
