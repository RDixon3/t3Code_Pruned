import {
  ServiceNowSdkStatusSchema,
  ServiceNowSdkUpdateSchema,
  ServiceNowSdkProfileSchema,
  ServiceNowSdkAuthSessionSchema,
} from "@t3tools/contracts";
import { DesktopEnvironment } from "../../app/DesktopEnvironment.ts";
import { sdkAuth, normalizeSdkProfile } from "../../integrations/serviceNowSdkAuth.ts";
import { ServiceNowSdkError } from "../../integrations/ServiceNowSdk.ts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { serviceNowSdk } from "../../integrations/ServiceNowSdk.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

export const checkServiceNowSdk = DesktopIpc.makeIpcMethod({
  channel: Channels.CHECK_SERVICENOW_SDK_CHANNEL,
  payload: Schema.Void,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.checkServiceNowSdk")(function* () {
    return yield* (yield* serviceNowSdk).check;
  }),
});

export const checkServiceNowSdkUpdates = DesktopIpc.makeIpcMethod({
  channel: Channels.CHECK_SERVICENOW_SDK_UPDATES_CHANNEL,
  payload: Schema.Void,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.checkServiceNowSdkUpdates")(function* () {
    return yield* (yield* serviceNowSdk).checkUpdates;
  }),
});
export const updateServiceNowSdk = DesktopIpc.makeIpcMethod({
  channel: Channels.UPDATE_SERVICENOW_SDK_CHANNEL,
  payload: ServiceNowSdkUpdateSchema,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.updateServiceNowSdk")(function* (input) {
    if (sdkAuth.isActive())
      return yield* new ServiceNowSdkError({
        message: "Finish or cancel SDK sign-in before updating.",
      });
    return yield* (yield* serviceNowSdk).update(input);
  }),
});

export const listServiceNowSdkProfiles = DesktopIpc.makeIpcMethod({
  channel: Channels.LIST_SERVICENOW_SDK_PROFILES_CHANNEL,
  payload: Schema.Void,
  result: Schema.Array(ServiceNowSdkProfileSchema),
  handler: Effect.fn("desktop.ipc.listServiceNowSdkProfiles")(function* () {
    return yield* (yield* serviceNowSdk).listProfiles;
  }),
});

export const deleteServiceNowSdkProfile = DesktopIpc.makeIpcMethod({
  channel: Channels.DELETE_SERVICENOW_SDK_PROFILE_CHANNEL,
  payload: ServiceNowSdkProfileSchema,
  result: Schema.Array(ServiceNowSdkProfileSchema),
  handler: Effect.fn("desktop.ipc.deleteServiceNowSdkProfile")(function* (profile) {
    return yield* (yield* serviceNowSdk).deleteProfile(profile);
  }),
});

export const installServiceNowSdk = DesktopIpc.makeIpcMethod({
  channel: Channels.INSTALL_SERVICENOW_SDK_CHANNEL,
  payload: Schema.Void,
  result: ServiceNowSdkStatusSchema,
  handler: Effect.fn("desktop.ipc.installServiceNowSdk")(function* () {
    return yield* (yield* serviceNowSdk).install;
  }),
});

export const addServiceNowSdkProfile = DesktopIpc.makeIpcMethod({
  channel: Channels.ADD_SERVICENOW_SDK_PROFILE_CHANNEL,
  payload: ServiceNowSdkProfileSchema,
  result: ServiceNowSdkAuthSessionSchema,
  handler: Effect.fn("desktop.ipc.addServiceNowSdkProfile")(function* (input) {
    const profile = yield* Effect.try({
      try: () => normalizeSdkProfile(input),
      catch: (error) =>
        new ServiceNowSdkError({
          message: error instanceof Error ? error.message : "Invalid profile.",
        }),
    });
    const sdk = yield* serviceNowSdk;
    const profiles = yield* sdk.listProfiles;
    if (profiles.some((existing) => existing.alias === profile.alias))
      return yield* new ServiceNowSdkError({
        message: "That profile name already exists. Choose another name.",
      });
    const status = yield* sdk.check;
    const environment = yield* DesktopEnvironment;
    return yield* Effect.tryPromise({
      try: () =>
        sdkAuth.start(
          environment.path.join(status.globalRoot, "@servicenow", "sdk", "bin", "index.js"),
          profile,
          environment.homeDirectory,
        ),
      catch: () =>
        new ServiceNowSdkError({
          message: "Could not start SDK sign-in. Check Node.js and your SDK installation.",
        }),
    });
  }),
});

export const completeServiceNowSdkProfile = DesktopIpc.makeIpcMethod({
  channel: Channels.COMPLETE_SERVICENOW_SDK_PROFILE_CHANNEL,
  payload: Schema.Struct({ sessionId: Schema.String, code: Schema.String }),
  result: ServiceNowSdkProfileSchema,
  handler: Effect.fn("desktop.ipc.completeServiceNowSdkProfile")(function* (input) {
    const profile = yield* Effect.tryPromise({
      try: () => sdkAuth.complete(input.sessionId, input.code),
      catch: (error) =>
        new ServiceNowSdkError({
          message: error instanceof Error ? error.message : "Sign-in failed.",
        }),
    });
    const profiles = yield* (yield* serviceNowSdk).listProfiles;
    if (
      !profiles.some(
        (saved) => saved.alias === profile.alias && saved.instanceUrl === profile.instanceUrl,
      )
    )
      return yield* new ServiceNowSdkError({
        message: "The SDK did not save the profile. Start sign-in again.",
      });
    return profile;
  }),
});

export const cancelServiceNowSdkProfile = DesktopIpc.makeIpcMethod({
  channel: Channels.CANCEL_SERVICENOW_SDK_PROFILE_CHANNEL,
  payload: Schema.Void,
  result: Schema.Void,
  handler: () => Effect.sync(() => sdkAuth.cancelAll()),
});

export const addBasicServiceNowSdkProfile = DesktopIpc.makeIpcMethod({
  channel: Channels.ADD_BASIC_SERVICENOW_SDK_PROFILE_CHANNEL,
  payload: Schema.Struct({
    alias: Schema.String,
    instanceUrl: Schema.String,
    username: Schema.String,
    password: Schema.String,
  }),
  result: ServiceNowSdkProfileSchema,
  handler: Effect.fn("desktop.ipc.addBasicServiceNowSdkProfile")(function* (input) {
    const profile = yield* Effect.try({
      try: () => normalizeSdkProfile(input),
      catch: () =>
        new ServiceNowSdkError({
          message: "Enter a valid profile name and HTTPS instance address.",
        }),
    });
    const sdk = yield* serviceNowSdk;
    const existing = yield* sdk.listProfiles;
    if (existing.some((saved) => saved.alias === profile.alias))
      return yield* new ServiceNowSdkError({
        message: "That profile name already exists. Choose another name.",
      });
    const status = yield* sdk.check;
    const environment = yield* DesktopEnvironment;
    yield* Effect.tryPromise({
      try: async () => {
        const session = await sdkAuth.start(
          environment.path.join(status.globalRoot, "@servicenow", "sdk", "bin", "index.js"),
          profile,
          environment.homeDirectory,
          { username: input.username, password: input.password },
        );
        await sdkAuth.complete(session.sessionId, "");
      },
      catch: () =>
        new ServiceNowSdkError({
          message:
            "Basic sign-in failed or was cancelled. Check your credentials and SDK installation.",
        }),
    });
    const profiles = yield* sdk.listProfiles;
    if (
      !profiles.some(
        (saved) => saved.alias === profile.alias && saved.instanceUrl === profile.instanceUrl,
      )
    )
      return yield* new ServiceNowSdkError({
        message: "The SDK did not save the profile. Check your credentials and instance access.",
      });
    return profile;
  }),
});
