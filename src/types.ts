/**
 * Shared TypeScript types for the Leadloadz MCP Server.
 */

/** Tool input schema as returned by the Leadloadz API */
export interface ToolSchema {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
}

/** Tool definition as returned by the Leadloadz API */
export interface Tool {
  name: string
  description: string
  inputSchema: ToolSchema
}

/** JSON-RPC request shape for tool calls */
export interface ToolCallRequest {
  jsonrpc: "2.0"
  id: number | string
  method: "tools/call"
  params: {
    name: string
    arguments: Record<string, unknown>
  }
}

/** JSON-RPC response shape */
export interface ToolCallResponse {
  jsonrpc: "2.0"
  id: number | string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** Server info returned by the Leadloadz API GET endpoint */
export interface ServerInfo {
  name: string
  version: string
  protocol: string
  tools: string[]
  transport: string[]
  usage: {
    rate_limit: string
    ip_rate_limit: string
  }
}

/** Generic JSON-RPC response */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0"
  id?: number | string
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** MCP error codes per specification */
export enum MCPErrorCode {
  // Standard JSON-RPC errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  // MCP-specific errors
  ConnectionClosed = -32000,
  RequestTimeout = -32001,
}

/** Configuration for the API client */
export interface APIClientConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}
