import { EnvironmentId } from "@t3tools/contracts";
import { RelayManagedEndpoint } from "@t3tools/contracts/relay";
import * as Schema from "effect/Schema";

export class RemoteDpopAccessToken extends Schema.Class<RemoteDpopAccessToken>(
  "@t3tools/client-runtime/authorization/RemoteDpopAccessToken",
)({
  environmentId: EnvironmentId,
  accountId: Schema.optionalKey(Schema.String),
  label: Schema.String,
  endpoint: RelayManagedEndpoint,
  accessToken: Schema.String,
  expiresAtEpochMs: Schema.Number,
  dpopThumbprint: Schema.String,
}) {}
