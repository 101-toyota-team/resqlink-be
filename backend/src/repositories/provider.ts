import { Provider } from "../types";

export interface IProviderRepository {
  searchProviders(
    raw: string,
    expanded: string,
    limit?: number,
  ): Promise<Provider[]>;
  findProvidersByH3Indexes(h3Indexes: string[]): Promise<Provider[]>;
}
