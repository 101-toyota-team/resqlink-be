export class GoogleMapsRepository {
  constructor(private apiKey: string) {}

  async getDistanceMatrix(origins: string[], destinations: string[]): Promise<any> {
    const originsQuery = origins.join('|');
    const destinationsQuery = destinations.join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/jsonorigins=${originsQuery}&destinations=${destinationsQuery}&key=${this.apiKey}`;

    const response = await fetch(url);
    return response.json();
  }

  async getDirections(origin: string, destination: string): Promise<any> {
    const url = `https://maps.googleapis.com/maps/api/directions/jsonorigin=${origin}&destination=${destination}&key=${this.apiKey}`;

    const response = await fetch(url);
    return response.json();
  }

  async searchPlaces(query: string): Promise<any> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/jsonquery=${encodeURIComponent(query)}&key=${this.apiKey}`;

    const response = await fetch(url);
    return response.json();
  }
}
