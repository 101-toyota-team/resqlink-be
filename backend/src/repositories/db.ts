export interface IPersistenceRepository {
  createBooking(data: any): Promise<any>;
  getBooking(id: string): Promise<any | null>;
  updateBookingStatus(id: string, status: string): Promise<void>;
  // Add other methods as needed (e.g. getHospitals, getAmbulanceDetails)
}
