const DEFAULT_TIMEOUT_MS = 15_000;

/** Openverse asks for a descriptive agent; the rest accept anything stable. */
export const USER_AGENT =
  "IdeaRefinery/0.1 (prototype; https://github.com/idea-refinery)";

const lastCall = new Map<string, number>();

/**
 * Adapters never throw, so a failed search would otherwise be indistinguishable
 * from an empty one. Each adapter records its reason here; federate reads and
 * clears it to set `ok`. Keyed by sourceId, so two concurrent searches of the
 * same source can interleave - acceptable for a prototype, not for production.
 */
const failures = new Map<string, string>();

export function noteFailure(sourceId: string, error: unknown): void {
  failures.set(sourceId, error instanceof Error ? error.message : String(error));
}

/** Reads and clears the recorded failure for a source. */
export function takeFailure(sourceId: string): string | null {
  const message = failures.get(sourceId) ?? null;
  failures.delete(sourceId);
  return message;
}

/** Serialises calls per source to the interval that source documents. */
async function throttle(sourceId: string, minIntervalMs: number): Promise<void> {
  if (minIntervalMs <= 0) return;
  const previous = lastCall.get(sourceId) ?? 0;
  const wait = previous + minIntervalMs - Date.now();
  lastCall.set(sourceId, Math.max(Date.now(), previous + minIntervalMs));
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export interface JsonOptions {
  sourceId: string;
  minIntervalMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export async function getJson<T>(url: string, options: JsonOptions): Promise<T> {
  await throttle(options.sourceId, options.minIntervalMs ?? 0);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": USER_AGENT, ...options.headers },
      cache: "no-store",
    });
    if (!response.ok) throw new HttpError(response.status, url);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}
