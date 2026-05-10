#!/usr/bin/env node

/**
 * Leadloadz MCP Server
 *
 * A Model Context Protocol server that exposes Leadloadz B2B lead search
 * and email verification tools to AI clients via stdio transport.
 *
 * Environment variables:
 *   LEADLOADZ_API_KEY  - Required. Your Leadloadz API token.
 *   LEADLOADZ_API_BASE - Optional. API base URL (default: https://www.leadloadz.com/api/mcp)
 *
 * Usage:
 *   npx @leadloadz/mcp-server
 *
 * Or configure in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "leadloadz": {
 *         "command": "npx",
 *         "args": ["-y", "@leadloadz/mcp-server"],
 *         "env": {
 *           "LEADLOADZ_API_KEY": "your-api-key-here"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { LeadloadzAPIClient } from "./api-client.js"
import type { Tool } from "./types.js"
import { MCPErrorCode } from "./types.js"

// ─── Prevent stdout pollution ────────────────────────────────────────────────
// The stdio transport uses stdout for JSON-RPC messages. Any other writes
// to stdout (console.log, stray dependency output) will corrupt the stream.
// We redirect all console methods to stderr.

const originalLog = console.log
const originalInfo = console.info
const originalWarn = console.warn
const originalError = console.error

console.log = (...args: unknown[]) => originalError("[log]", ...args)
console.info = (...args: unknown[]) => originalError("[info]", ...args)
console.warn = (...args: unknown[]) => originalError("[warn]", ...args)
// console.error stays on stderr (no change needed)

// Also catch any unhandled errors and write to stderr
// Sanitize errors to prevent leaking sensitive info (stack traces, file paths)
function sanitizeFatalError(err: unknown): string {
  if (err instanceof Error) {
    // Only log the error message, not the stack trace
    // Stack traces can reveal file paths and internal implementation details
    return err.message
  }
  return String(err)
}

process.on("uncaughtException", (err) => {
  originalError("[fatal] Uncaught exception:", sanitizeFatalError(err))
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  originalError("[fatal] Unhandled rejection:", sanitizeFatalError(reason))
  process.exit(1)
})

// ─── Configuration ───────────────────────────────────────────────────────────

const API_KEY = process.env.LEADLOADZ_API_KEY
const API_BASE =
  process.env.LEADLOADZ_API_BASE || "https://www.leadloadz.com/api/mcp"
const TIMEOUT_MS = parseInt(process.env.LEADLOADZ_TIMEOUT_MS || "30000", 10)

if (!API_KEY) {
  originalError(
    "[fatal] LEADLOADZ_API_KEY environment variable is required.\n" +
      "Get your API key from: https://www.leadloadz.com/dashboard/api-tokens\n" +
      "Then set it in your MCP client configuration."
  )
  process.exit(1)
}

// Validate API base URL to prevent SSRF attacks
// Only allow HTTPS URLs to ensure API keys are never sent over plaintext
try {
  const parsedUrl = new URL(API_BASE)
  if (parsedUrl.protocol !== "https:") {
    originalError(
      "[fatal] LEADLOADZ_API_BASE must use HTTPS protocol for security.\n" +
        `Current value: ${API_BASE}\n` +
        "The API key must never be transmitted over unencrypted connections."
    )
    process.exit(1)
  }
} catch {
  originalError(
    "[fatal] LEADLOADZ_API_BASE is not a valid URL.\n" +
      `Current value: ${API_BASE}`
  )
  process.exit(1)
}

// ─── API Client ──────────────────────────────────────────────────────────────

const apiClient = new LeadloadzAPIClient({
  baseUrl: API_BASE,
  apiKey: API_KEY,
  timeoutMs: TIMEOUT_MS,
})

// ─── Tool Cache ──────────────────────────────────────────────────────────────
// We fetch tools from the API at startup to avoid schema duplication.

let cachedTools: Tool[] = []

async function fetchTools(): Promise<void> {
  const result = await apiClient.safeCall(() => apiClient.listTools())

  if (!result.success) {
    originalError("[fatal] Failed to fetch tool list from Leadloadz API:", result.error)
    process.exit(1)
  }

  cachedTools = result.data
  originalError(`[info] Loaded ${cachedTools.length} tools from Leadloadz API`)
}

// ─── Health Check ────────────────────────────────────────────────────────────
// Validate API connectivity and credentials on startup.

async function healthCheck(): Promise<void> {
  originalError("[info] Performing startup health check...")

  const result = await apiClient.safeCall(() => apiClient.getServerInfo())

  if (!result.success) {
    originalError("[warn] Health check failed:", result.error)
    originalError(
      "[warn] Please verify your LEADLOADZ_API_KEY is correct and the API is accessible."
    )
    return
  }

  const info = result.data
  originalError(`[info] Connected to Leadloadz API: ${info.name} v${info.version}`)
  originalError(`[info] Available tools: ${info.tools.join(", ")}`)
  originalError(`[info] Rate limit: ${info.usage.rate_limit}`)
}

// ─── MCP Server Setup ────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "leadloadz-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: cachedTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  // Validate tool exists
  const tool = cachedTools.find((t) => t.name === name)
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Unknown tool: '${name}'. Available tools: ${cachedTools.map((t) => t.name).join(", ")}`,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    }
  }

  // Call the API
  const result = await apiClient.safeCall(() => apiClient.callTool(name, args || {}))

  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: result.error }, null, 2),
        },
      ],
      isError: true,
    }
  }

  const response = result.data

  // Check for JSON-RPC error in the response
  if (response.error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: response.error.message,
              code: response.error.code,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    }
  }

  // Return successful result
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response.result, null, 2),
      },
    ],
  }
})

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Startup sequence: health check, then fetch tools, then start server
  await healthCheck()
  await fetchTools()

  const transport = new StdioServerTransport()
  await server.connect(transport)

  originalError("[info] Leadloadz MCP server running on stdio")
}

main().catch((err) => {
  originalError("[fatal] Server failed to start:", sanitizeFatalError(err))
  process.exit(1)
})
