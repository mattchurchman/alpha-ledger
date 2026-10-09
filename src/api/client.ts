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
 * No valid session: either this device has never been unlocked, or its year-long cookie has
 * expired, or the token was rotated. The cure is the unlock screen, not an error message -
 * which is why this is a distinct type rather than an `ApiError` with status 401.
 */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Enter your access token to unlock.') {
    super(message)
    this.name = 'NotAuthenticatedError'
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
      // Carries the signed `al_session` cookie, which is what the Worker checks.
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })

    const contentType = response.headers.get('Content-Type') ?? ''
    const isJson = contentType.includes('application/json')

    // A safety net rather than an expected path: every `/api` answer is JSON or an empty 204.
    if (!isJson && response.status !== 204) {
      if (response.status === 401) throw new NotAuthenticatedError()
      throw new ApiError(response.status, `Unexpected response (HTTP ${response.status})`)
    }

    if (response.status === 204) return undefined as T

    const body: unknown = await response.json()
    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${response.status}`
      // 401 means "no session"; 403 on a data route means the session or token was rejected.
      // Both land on the unlock screen, so both become the same error for the UI.
      if (response.status === 401 || message === 'invalid-session') {
        throw new NotAuthenticatedError()
      }
      throw new ApiError(response.status, message)
    }
    return body as T
  }

  const send = <T>(method: string, path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

  return {
    health: () => request<{ status: string }>('/api/health'),

    session: {
      /** Exchanges the token for a year-long signed cookie. The token is not stored anywhere. */
      unlock: (token: string) =>
        send<{ expires_at: number }>('POST', '/api/session', { token }),
      signOut: () => send<void>('DELETE', '/api/session'),
      /** Throws `NotAuthenticatedError` when this device has no valid session. */
      check: () => request<{ authenticated: true }>('/api/session'),
    },

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
