import { Provider } from "../types";

export interface IProviderRepository {
  searchProviders(raw: string, expanded: string): Promise<Provider[]>;
  findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]>;
}
