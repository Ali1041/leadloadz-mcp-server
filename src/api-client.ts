import type { APIClientConfig, Tool, ServerInfo, ToolCallResponse, JsonRpcResponse } from "./types.js"
import { MCPErrorCode } from "./types.js"

/**
 * Leadloadz API client.
 *
 * Handles HTTP communication with the Leadloadz MCP API endpoint.
 * All errors are sanitized to prevent leaking secrets or internal details.
 */
export class LeadloadzAPIClient {
  private readonly config: APIClientConfig

  constructor(config: APIClientConfig) {
    this.config = config
  }

  /**
   * Build request headers with the API key.
   */
  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "User-Agent": "leadloadz-mcp-server/1.1.0",
      "X-Source": "mcp-server",
    }
  }

  /**
   * Perform a fetch with timeout support.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Request timed out after ${this.config.timeoutMs}ms. The Leadloadz API may be temporarily unavailable.`, { cause: err }
        )
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Escape special regex characters in a string.
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  /**
   * Sanitize an error to ensure no sensitive data leaks.
   */
  private sanitizeError(err: unknown): Error {
    if (err instanceof Error) {
      // Remove any potential API key leakage from the message
      // Escape regex special characters in the API key first
      const safeKey = this.escapeRegExp(this.config.apiKey)
      let message = err.message.replace(new RegExp(safeKey, "g"), "[REDACTED]")
      // Remove potential URL leakage with query params
      message = message.replace(/https?:\/\/[^\s]+/g, "[URL_REDACTED]")
      return new Error(message)
    }
    return new Error(String(err))
  }

  /**
   * Fetch server info (health check / tool discovery).
   */
  async getServerInfo(): Promise<ServerInfo> {
    const url = `${this.config.baseUrl}`
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: this.headers(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please check your LEADLOADZ_API_KEY is valid and not revoked."
        )
      }
      throw new Error(
        `Leadloadz API returned status ${response.status}. Please try again later.`
      )
    }

    const data = (await response.json()) as unknown as ServerInfo
    return data
  }

  /**
   * Fetch the list of available tools from the API.
   * This avoids duplicating tool schemas in the MCP server.
   */
  async listTools(): Promise<Tool[]> {
    const url = `${this.config.baseUrl}`
    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch tool list from Leadloadz API (status ${response.status}).`
      )
    }

    const data = (await response.json()) as unknown as JsonRpcResponse<{ tools: Tool[] }>

    if (data.error) {
      throw new Error(data.error.message || "Failed to fetch tool list")
    }

    return data.result?.tools || []
  }

  /**
   * Call a tool via the Leadloadz API.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResponse> {
    const url = `${this.config.baseUrl}`

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args,
        },
      }),
    })

    if (!response.ok) {
      // Map HTTP status codes to user-friendly messages
      const status = response.status
      let message: string

      switch (status) {
        case 401:
          message =
            "Authentication failed. Your API key may be invalid or revoked."
          break
        case 403:
          message =
            "Access denied. Your API key does not have permission to use this tool."
          break
        case 429:
          message =
            "Rate limit exceeded. Please wait a moment before trying again."
          break
        case 500:
        case 502:
        case 503:
        case 504:
          message =
            "The Leadloadz API is temporarily unavailable. Please try again later."
          break
        default:
          message = `The Leadloadz API returned an error (status ${status}). Please try again.`
      }

      return {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: MCPErrorCode.InternalError,
          message,
        },
      }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: MCPErrorCode.InternalError,
          message:
            "The Leadloadz API returned an invalid response. Please try again later.",
        },
      }
    }
    return data as ToolCallResponse
  }

  /**
   * Wrap any API call with error sanitization.
   */
  async safeCall<T>(
    operation: () => Promise<T>
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      const data = await operation()
      return { success: true, data }
    } catch (err) {
      const sanitized = this.sanitizeError(err)
      return { success: false, error: sanitized.message }
    }
  }
}
