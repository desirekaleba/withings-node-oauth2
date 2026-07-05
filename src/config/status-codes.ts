/**
 * Human-readable descriptions for Withings API `status` codes.
 *
 * Withings returns a numeric `status` in every response body (`0` = success).
 * The list below covers the codes the docs and support surface most often; it
 * is intentionally partial — unknown codes fall back to a generic message.
 *
 * @see https://developer.withings.com/api-reference/#section/Response-status-codes
 */
export const STATUS_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: "Operation was successful.",
  100: "The hash is missing, invalid, or does not match the parameters.",
  201: "Invalid or missing parameters.",
  214: "The user is not authorized (missing or insufficient scope).",
  247: "The userid provided is absent or incorrect.",
  250: "The provided userid and/or Oauth credentials do not match.",
  264: "Unknown or invalid email/userid.",
  283: "Token is invalid or does not exist.",
  286: "No such subscription was found.",
  293: "The callback URL is either absent or incorrect.",
  294: "No such subscription could be deleted.",
  304: "The comment is either absent or incorrect.",
  342: "The signature (hash) is invalid, or the nonce is invalid/expired.",
  343: "Wrong nonce.",
  601: "Too many requests — the rate limit was exceeded.",
  2554: "Unspecified or unknown error occurred.",
  2555: "An unknown error occurred on the Withings side.",
  2556: "The service is not defined.",
} as const;

/** Return a description for a Withings status code, or `undefined` if unknown. */
export function describeStatus(status: number): string | undefined {
  return STATUS_DESCRIPTIONS[status];
}
