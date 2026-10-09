import { BadRequest } from './validate'

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new BadRequest('Request body must be valid JSON')
  }
}

/**
 * Turns a thrown `BadRequest` into a 400 and anything else into a 500 whose body says
 * nothing about the failure. An unexpected error could carry a SQL fragment or a row value,
 * and the ledger is private (SPEC 10); the detail goes to the Worker log instead.
 */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof BadRequest) return apiError(err.message, 400)
  console.error('Unhandled /api error:', err)
  return apiError('Internal error', 500)
}
