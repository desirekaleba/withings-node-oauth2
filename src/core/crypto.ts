import { createHmac } from "node:crypto";

/**
 * Compute the HMAC-SHA256 signature Withings requires for signed actions.
 *
 * The message is the parameter **values** ordered alphabetically by their key,
 * joined with commas, keyed with the application's client secret. Because the
 * relevant keys always sort as `action < client_id < {nonce|timestamp}`, the
 * effective message is `"{action},{clientId},{baseValue}"`.
 *
 * @param action - The API action being signed (e.g. `"getnonce"`).
 * @param clientId - Withings application client id.
 * @param clientSecret - Withings application client secret (the HMAC key).
 * @param baseValue - The nonce (for signed calls) or timestamp (for getnonce).
 * @returns Hex-encoded signature.
 *
 * @see https://developer.withings.com/developer-guide/v3/get-access/sign-your-requests/
 */
export function generateSignature(
  action: string,
  clientId: string,
  clientSecret: string,
  baseValue: string | number,
): string {
  const message = `${action},${clientId},${baseValue}`;
  return createHmac("sha256", clientSecret).update(message).digest("hex");
}
