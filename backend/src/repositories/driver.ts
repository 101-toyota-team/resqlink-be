import { Driver } from "../types";

export interface IDriverRepository {
  getDriver(driverId: string): Promise<Driver | null>;
  updateAvailability(driverId: string, isAvailable: boolean): Promise<void>;
}
