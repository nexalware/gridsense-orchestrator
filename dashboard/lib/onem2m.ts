// Minimal typed oneM2M HTTP client (Mca/Mcc over HTTP, release 3).
//
// Shared by the dashboard's server-side route handlers and the dev feed
// script. It has no dependencies and uses only TypeScript syntax that Node can
// strip, so `node scripts/dev-feed.ts` can import it directly. Intended to move
// into libs/onem2m later.
//
// Never import this from client components: requests carry the originator.

export const ResourceType = {
  accessControlPolicy: 1,
  AE: 2,
  container: 3,
  contentInstance: 4,
} as const;
export type ResourceTypeCode = (typeof ResourceType)[keyof typeof ResourceType];

/** accessControlOperations bit mask (TS-0004). */
export const Operation = {
  CREATE: 1,
  RETRIEVE: 2,
  UPDATE: 4,
  DELETE: 8,
  NOTIFY: 16,
  DISCOVER: 32,
  ALL: 63,
} as const;

/** Short resource-type names used as the JSON root key, e.g. {"m2m:cin": {...}}. */
const typeKey: Record<ResourceTypeCode, string> = {
  1: "m2m:acp",
  2: "m2m:ae",
  3: "m2m:cnt",
  4: "m2m:cin",
};

export interface OneM2MConfig {
  /** Scheme, host and port of the CSE the requests go to, e.g. http://mobius4:7599 */
  baseUrl: string;
  /** Path of the target CSEBase, e.g. /~/id-mn/cse-mn (SP-relative) */
  csePath: string;
  /** X-M2M-Origin of every request */
  originator: string;
  /** Per-request timeout in milliseconds (default 4000) */
  timeoutMs?: number;
}

export interface ContentInstance {
  rn: string;
  ri: string;
  ct: string;
  con: string;
  cnf?: string;
}

/** A oneM2M error response: HTTP status, oneM2M response status code and debug text. */
export class OneM2MError extends Error {
  readonly status: number;
  readonly rsc: string | null;

  constructor(message: string, status: number, rsc: string | null) {
    super(message);
    this.name = "OneM2MError";
    this.status = status;
    this.rsc = rsc;
  }

  get notFound(): boolean {
    return this.status === 404 || this.rsc === "4004";
  }

  get conflict(): boolean {
    return this.status === 409 || this.rsc === "4105";
  }
}

export interface OneM2MClient {
  readonly config: OneM2MConfig;
  /** RETRIEVE a resource. `path` is relative to the CSEBase ("" for the CSEBase itself). */
  retrieve<T = unknown>(path: string): Promise<T>;
  /** CREATE a child resource of type `ty` under `parentPath`. `body` is the inner object. */
  create<T = unknown>(parentPath: string, ty: ResourceTypeCode, body: object): Promise<T>;
  /** UPDATE a resource of type `ty`. `body` is the inner object with the changed attributes. */
  update<T = unknown>(path: string, ty: ResourceTypeCode, body: object): Promise<T>;
  /** RETRIEVE the latest <contentInstance> of a container and parse its JSON content. Null if the container is empty. */
  latestJson<T = unknown>(containerPath: string): Promise<{ content: T; cin: ContentInstance } | null>;
  /** CREATE a <contentInstance> whose content is `value` serialised as JSON. */
  addJson(containerPath: string, value: unknown): Promise<ContentInstance>;
}

let requestCounter = 0;

/** Unique X-M2M-RI per request: random part plus a process-local counter. */
function newRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  return `gs-${globalThis.crypto.randomUUID()}-${requestCounter}`;
}

function joinPath(csePath: string, path: string): string {
  const base = csePath.replace(/\/+$/, "");
  const rel = path.replace(/^\/+/, "");
  return rel ? `${base}/${rel}` : base;
}

export function createOneM2MClient(config: OneM2MConfig): OneM2MClient {
  const timeoutMs = config.timeoutMs ?? 4000;

  async function request<T>(method: string, path: string, ty?: ResourceTypeCode, body?: object): Promise<T> {
    const url = config.baseUrl.replace(/\/+$/, "") + joinPath(config.csePath, path);
    const headers: Record<string, string> = {
      "X-M2M-Origin": config.originator,
      "X-M2M-RI": newRequestId(),
      "X-M2M-RVI": "3",
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = method === "POST" && ty !== undefined ? `application/json;ty=${ty}` : "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    const rsc = response.headers.get("X-M2M-RSC");
    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { "m2m:dbg"?: string };
        detail = parsed["m2m:dbg"] ?? text;
      } catch {
        // not JSON: keep the raw text
      }
      throw new OneM2MError(`${method} ${path || "/"} failed: HTTP ${response.status}${rsc ? ` RSC ${rsc}` : ""}: ${detail}`, response.status, rsc);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  function unwrap<T>(ty: ResourceTypeCode, json: unknown): T {
    const key = typeKey[ty];
    const record = json as Record<string, unknown>;
    return (record[key] ?? json) as T;
  }

  return {
    config,
    retrieve: <T>(path: string) => request<T>("GET", path),
    async create<T>(parentPath: string, ty: ResourceTypeCode, body: object) {
      return unwrap<T>(ty, await request("POST", parentPath, ty, { [typeKey[ty]]: body }));
    },
    async update<T>(path: string, ty: ResourceTypeCode, body: object) {
      return unwrap<T>(ty, await request("PUT", path, undefined, { [typeKey[ty]]: body }));
    },
    async latestJson<T>(containerPath: string) {
      let cin: ContentInstance;
      try {
        cin = unwrap<ContentInstance>(ResourceType.contentInstance, await request("GET", `${containerPath}/la`));
      } catch (error) {
        // An empty container answers "not found" for /la.
        if (error instanceof OneM2MError && error.notFound) return null;
        throw error;
      }
      return { content: JSON.parse(cin.con) as T, cin };
    },
    async addJson(containerPath: string, value: unknown) {
      return unwrap<ContentInstance>(
        ResourceType.contentInstance,
        await request("POST", containerPath, ResourceType.contentInstance, {
          [typeKey[ResourceType.contentInstance]]: { cnf: "application/json:0", con: JSON.stringify(value) },
        }),
      );
    },
  };
}
