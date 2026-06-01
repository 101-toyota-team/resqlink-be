import { IAmbulanceRepository } from "../repositories/ambulance";
import { AmbulanceDetails } from "../types";
import { IGeoService } from "./geo";
import { IDistanceService } from "./distance";
import { ISimulationService } from "./simulation";
import { DISTANCE_SERVICE } from "../utils/constants";

export interface IDispatchService {
  findNearbyAmbulances(
    h3Index: string,
    radius?: number,
    pickupLocation?: string,
  ): Promise<AmbulanceDetails[]>;
  advanceSimulation(bookingId: string, steps: number): Promise<void>;
}

export class DispatchService implements IDispatchService {
  constructor(
    private ambulanceRepo: IAmbulanceRepository,
    private geo: IGeoService,
    private distance: IDistanceService,
    private simulation: ISimulationService,
  ) {}

  async findNearbyAmbulances(
    h3Index: string,
    radius: number = 1,
    pickupLocation?: string,
  ): Promise<AmbulanceDetails[]> {
    const neighbors = this.geo.getNeighbors(h3Index, radius);

    const drivers = await this.ambulanceRepo.findAvailableAmbulances(neighbors);

    if (drivers.length === 0) {
      return [];
    }

    if (pickupLocation && drivers.length > 0) {
      const limitedDrivers = drivers.slice(
        0,
        DISTANCE_SERVICE.MAX_DRIVERS_PER_LOCATION,
      );
      return await this.distance.getEnrichedDrivers(
        limitedDrivers,
        pickupLocation,
      );
    }

    return drivers;
  }

  async advanceSimulation(bookingId: string, steps: number = 1): Promise<void> {
    await this.simulation.advanceSimulation(bookingId, steps);
  }
}
