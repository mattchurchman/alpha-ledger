/**
 * Typed browser client for `/api/*`. Every screen talks to the Worker through this and
 * nothing else, so the wire shapes in `types.ts` are the only contract either side knows.
 */

import type { PriceHistory } from '../engine/prices/types'
import type {
  BulkUpsertResult,
  ExportBundle,
  FairValueInput,
  FairValueRow,
  MetaMap,
  PriceHistoryInput,
  RestoreBundle,
  RestoreResult,
  StoredPriceHistory,
  TickerAlias,
  TransactionInput,
  TransactionPatch,
  TransactionRow,
  TransactionType,
} from './types'

/** A request the API answered with a 4xx/5xx and a JSON `{ error }` body. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * The Access session has run out. `fetch` cannot complete the login - it is a cross-origin
 * redirect to `cloudflareaccess.com` - so the only cure is a full page navigation, which is
 * what the UI should do when it sees this. Distinguishing it from `ApiError` is what keeps a
 * screen from showing "something went wrong" when the real answer is "sign in again".
 */
export class AccessExpiredError extends Error {
  constructor() {
    super('Your sign-in has expired. Reload the page to sign in again.')
    this.name = 'AccessExpiredError'
  }
}

export interface TransactionFilters {
  ticker?: string
  account?: string
  type?: TransactionType
}

function query(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value !== '') params.set(key, value)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export interface ApiClientOptions {
  /** Defaults to same-origin. Set only for a test or a local front end hitting a remote API. */
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? ''
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      // Carries the CF_Authorization cookie, which is what Access turns into the JWT header.
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })

    // An expired Access session answers with the login page, not JSON. Treat any non-JSON
    // body as that rather than trying to parse it.
    const contentType = response.headers.get('Content-Type') ?? ''
    const isJson = contentType.includes('application/json')
    if (!isJson && response.status !== 204) {
      if (response.status === 401 || response.status === 403 || response.redirected || response.ok) {
        throw new AccessExpiredError()
      }
      throw new ApiError(response.status, `Unexpected response (HTTP ${response.status})`)
    }

    if (response.status === 204) return undefined as T

    const body: unknown = await response.json()
    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${response.status}`
      throw new ApiError(response.status, message)
    }
    return body as T
  }

  const send = <T>(method: string, path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

  return {
    health: () => request<{ status: string }>('/api/health'),

    transactions: {
      list: (filters: TransactionFilters = {}) =>
        request<TransactionRow[]>(`/api/transactions${query(filters)}`),
      create: (input: TransactionInput) => send<TransactionRow>('POST', '/api/transactions', input),
      /** Import path: new hashes are inserted, known ones are left exactly as they are. */
      bulkUpsert: (transactions: TransactionInput[]) =>
        send<BulkUpsertResult>('POST', '/api/transactions/bulk', { transactions }),
      update: (id: number, patch: TransactionPatch) =>
        send<TransactionRow>('PATCH', `/api/transactions/${id}`, patch),
      setExcluded: (id: number, excluded: boolean) =>
        send<TransactionRow>('POST', `/api/transactions/${id}/exclude`, { excluded }),
      remove: (id: number) => send<void>('DELETE', `/api/transactions/${id}`),
    },

    aliases: {
      list: () => request<TickerAlias[]>('/api/aliases'),
      create: (alias: TickerAlias) => send<TickerAlias>('POST', '/api/aliases', alias),
      remove: (fromTicker: string, effectiveDate: string) =>
        send<void>('DELETE', `/api/aliases/${encodeURIComponent(fromTicker)}/${effectiveDate}`),
    },

    fairValues: {
      list: (ticker?: string) => request<FairValueRow[]>(`/api/fair-values${query({ ticker })}`),
      /** Append-only: this adds a row, it never edits one (SPEC 3). */
      create: (input: FairValueInput) => send<FairValueRow>('POST', '/api/fair-values', input),
      remove: (id: number) => send<void>('DELETE', `/api/fair-values/${id}`),
    },

    priceHistory: {
      list: () => request<StoredPriceHistory[]>('/api/price-history'),
      put: (ticker: string, input: PriceHistoryInput) =>
        send<StoredPriceHistory>('PUT', `/api/price-history/${encodeURIComponent(ticker)}`, input),
    },

    /** Live fetch from Yahoo through the Worker. Storing the result is a separate call. */
    prices: {
      fetch: (ticker: string, from: string) =>
        request<PriceHistory>(`/api/prices/${encodeURIComponent(ticker)}${query({ from })}`),
    },

    meta: {
      get: () => request<MetaMap>('/api/meta'),
      put: (key: string, value: string) =>
        send<{ key: string; value: string }>('PUT', `/api/meta/${encodeURIComponent(key)}`, { value }),
    },

    exportAll: () => request<ExportBundle>('/api/export'),
    /** Replaces the whole database with the bundle. */
    restore: (bundle: RestoreBundle) => send<RestoreResult>('POST', '/api/restore', bundle),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/** The instance every screen uses. */
export const api: ApiClient = createApiClient()
