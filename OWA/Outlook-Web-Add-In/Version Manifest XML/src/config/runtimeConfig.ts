/**
 * Runtime Configuration Patches
 *
 * Some config values are not known at build time and must be set after the app
 * initialises (e.g. user identity, signaling-server-provided API address).
 * Call these setters early in the startup flow so dependent services pick up
 * the correct values before they try to connect.
 */

import { configService } from "./index";

/**
 * Set the calling-party identity for SIP.
 * Call this once the user's identity is resolved (e.g. after Office Auth / AAD).
 *
 * @param identifier - A unique user identifier, typically the user's e-mail address.
 *                     It becomes the SIP fromDisplayName and is embedded in the sipUri.
 *
 * @example
 *   setUserIdentifier("john.doe@advokat.com");
 */
export function setUserIdentifier(identifier: string): void {
  if (!identifier) return;

  const { host, port } = configService.getSipConfig();
  configService.patchSipConfig({
    fromDisplayName: identifier,
    sipUri: `sip:${identifier}@${host}:${port}`,
  });
}

/**
 * Set the destination ADVOKAT Server for SIP REGISTER.
 * Call this once the Pairing API has resolved the advokatServerId for this user
 * (see pairingSlice / PairingApiService), before the SIP client connects.
 *
 * It becomes the SIP toDisplayName, so it is sent in the REGISTER message's
 * "To:" header — routing the registration to the correct ADVOKAT Server.
 *
 * @param serverId - The advokatServerId returned by the Pairing API.
 *
 * @example
 *   setAdvokatServerId("server-123");
 */
export function setAdvokatServerId(serverId: string): void {
  if (!serverId) return;

  configService.patchSipConfig({
    toDisplayName: serverId,
  });
}

