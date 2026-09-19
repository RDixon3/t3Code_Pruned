import * as Schema from "effect/Schema";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

// Retained only to decode legacy connection catalogs; CoCo has no relay client.
const RelayManagedEndpointProviderKind = Schema.Literals([
  "manual",
  "cloudflare_tunnel",
  "t3_relay",
]);

export const RelayManagedEndpoint = Schema.Struct({
  httpBaseUrl: TrimmedNonEmptyString,
  wsBaseUrl: TrimmedNonEmptyString,
  providerKind: RelayManagedEndpointProviderKind,
});
export type RelayManagedEndpoint = typeof RelayManagedEndpoint.Type;
