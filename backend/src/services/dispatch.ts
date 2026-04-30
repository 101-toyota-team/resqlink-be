import * as h3 from 'h3-js';
import { ICacheRepository } from '../repositories/cache';
import { GoogleMapsRepository } from '../infrastructure/google-maps';

export class DispatchService {
  constructor(
    private cache: ICacheRepository,
    private maps: GoogleMapsRepository
  ) {}

  async findNearbyDrivers(h3Index: string, radius: number = 1, pickupLocation?: string): Promise<any[]> {
    // Find neighbors (Ring radius)
    const neighbors = h3.gridDisk(h3Index, radius);
    
    // Fetch driver IDs from all relevant H3 buckets in parallel
    const driverIdSets = await Promise.all(
      neighbors.map(idx => this.cache.getDriversInBucket(idx))
    );
    
    const driverIds = [...new Set(driverIdSets.flat())];
    
    // Fetch actual locations and details for these drivers
    const drivers = await Promise.all(
      driverIds.map(id => this.cache.getDriverLocation(id))
    );

    const validDrivers = drivers.filter(d => d !== null);

    if (pickupLocation && validDrivers.length > 0) {
      const driverLocations = validDrivers.map(d => `${d.lat},${d.lng}`);
      const matrix = await this.maps.getDistanceMatrix(driverLocations, [pickupLocation]);
      
      return validDrivers.map((d, i) => ({
        ...d,
        eta: matrix.rows[i].elements[0].duration.text,
        distance: matrix.rows[i].elements[0].distance.text
      }));
    }

    return validDrivers;
  }

  async updateDriverStatus(driverId: string, locationData: any, h3Index: string): Promise<void> {
    // 15s TTL as per requirements
    await this.cache.updateDriverLocation(driverId, locationData, h3Index, 15);
  }
}
