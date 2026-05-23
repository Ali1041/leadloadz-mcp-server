/**
 * Anonymous telemetry for the Leadloadz MCP Server.
 *
 * All events are fire-and-forget. Failures are silently ignored
 * so telemetry never blocks the server.
 */

import { normalizeApiBase } from "./config.js"

const PACKAGE_VERSION = "1.1.0"
const TELEMETRY_TIMEOUT_MS = 5000

export interface TelemetryEvent {
  event: string
  package_version: string
  session_id: string
  timestamp: string
  has_api_key: boolean
  metadata?: Record<string, unknown>
}

/**
 * Generate a random session ID.
 */
export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Telemetry tracker that sends events to the Leadloadz backend.
 */
export class TelemetryTracker {
  private readonly sessionId: string
  private readonly apiBase: string
  private readonly hasApiKey: boolean
  private readonly disabled: boolean

  constructor(sessionId: string, apiBase: string, hasApiKey: boolean) {
    this.sessionId = sessionId
    this.apiBase = normalizeApiBase(apiBase)
    this.hasApiKey = hasApiKey
    this.disabled = process.env.LEADLOADZ_DISABLE_TELEMETRY === "1"
  }

  /**
   * Track an event. Fire-and-forget — never throws.
   * If LEADLOADZ_DISABLE_TELEMETRY=1, this is a no-op.
   */
  track(event: string, metadata?: Record<string, unknown>): void {
    if (this.disabled) return

    const payload: TelemetryEvent = {
      event,
      package_version: PACKAGE_VERSION,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      has_api_key: this.hasApiKey,
      metadata: metadata || {},
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS)

    fetch(`${this.apiBase}/telemetry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Source": "mcp-server",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .catch(() => {
        // Silent fail — telemetry must never break the server
      })
      .finally(() => {
        clearTimeout(timeoutId)
      })
  }
}
