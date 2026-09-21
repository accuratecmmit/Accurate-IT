/**
 * Resilient API Client & JSON parser
 * Prevents "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" crashes
 * when requests receive HTML error pages, reverse proxy 502/503s, or unmatched endpoints.
 */

export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Safely parses Response text as JSON without throwing SyntaxError if the response is HTML.
 */
export async function parseResponseJson<T = any>(
  res: Response,
  fallbackError = 'Unexpected server response'
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return {
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : (fallbackError || `HTTP ${res.status}`),
      };
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
      return {
        ok: false,
        status: res.status,
        error: `Server returned HTML (${res.status}): Please refresh or verify authentication.`,
      };
    }

    const json = JSON.parse(trimmed);
    return {
      ok: res.ok,
      status: res.status,
      data: json,
      error: res.ok ? undefined : (json.error || json.message || fallbackError || `HTTP ${res.status}`),
    };
  } catch (parseErr: any) {
    return {
      ok: false,
      status: res.status,
      error: `Failed to parse response: ${parseErr?.message || fallbackError}`,
    };
  }
}

/**
 * Executes fetch and safely returns parsed JSON with error isolation.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = 'Network request failed'
): Promise<SafeApiResponse<T>> {
  try {
    const res = await fetch(input, init);
    return await parseResponseJson<T>(res, fallbackError);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || fallbackError,
    };
  }
}

/**
 * Convenience drop-in replacement for `await res.json()`.
 * Checks for HTML / invalid responses and throws a clean Error with message
 * instead of letting JSON.parse crash with "Unexpected token '<'".
 */
export async function safeJson<T = any>(res: Response, defaultMessage = 'Server request failed'): Promise<T> {
  const parsed = await parseResponseJson<T>(res, defaultMessage);
  if (!parsed.ok || !parsed.data) {
    const msg = parsed.error || defaultMessage;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).response = parsed;
    throw err;
  }
  return parsed.data;
}

