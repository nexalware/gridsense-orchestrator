import "server-only";

import { OneM2MError } from "@/lib/onem2m";
import type { StateError } from "@/lib/gridsense";
import { ConfigError } from "@/lib/server/state";

/**
 * Details stay in the server log. The browser gets status codes only: oneM2M
 * debug text can contain the originator.
 */
export function toClientError(error: unknown): { body: StateError; status: number } {
  console.error("[api] oneM2M request failed:", error instanceof Error ? error.message : error);
  let message = "oneM2M is unreachable";
  if (error instanceof ConfigError) message = error.message;
  else if (error instanceof OneM2MError) message = `oneM2M request failed (HTTP ${error.status}${error.rsc ? `, RSC ${error.rsc}` : ""})`;
  return {
    body: { error: message, fetchedAt: new Date().toISOString() },
    status: error instanceof ConfigError ? 500 : 502,
  };
}
