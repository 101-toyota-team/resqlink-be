import { providerNearbySchema } from "./src/schemas";
const res = providerNearbySchema.safeParse({ h3_index: "878c10702ffffff" });
console.log(JSON.stringify(res, null, 2));
