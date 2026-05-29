#!/usr/bin/env node
/**
 * Leadloadz MCP Server
 *
 * A Model Context Protocol server that exposes Leadloadz B2B lead search
 * and email verification tools to AI clients via stdio transport.
 *
 * Environment variables:
 *   LEADLOADZ_API_KEY  - Required. Your Leadloadz API token.
 *   LEADLOADZ_API_BASE - Optional. API base URL (default: https://leadloadz.com/api/mcp)
 *
 * Usage:
 *   npx @leadloadz/mcp-server
 *
 * Setup wizard:
 *   npx @leadloadz/mcp-server --setup
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
import { redirectConsoleToStderr, stderrLog, sanitizeFatalError } from "./logger.js"
import { isSetupMode, showSetupCTA, runSetupWizard } from "./onboarding.js"
import { TelemetryTracker, generateSessionId } from "./telemetry.js"
import { DEFAULT_API_BASE, normalizeApiBase, PACKAGE_VERSION } from "./config.js"

// ─── Redirect stdout pollution to stderr BEFORE anything else ─────────────────
redirectConsoleToStderr()

// ─── Catch unhandled errors ──────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  stderrLog("[fatal] Uncaught exception:", sanitizeFatalError(err))
  process.exit(1)
})
process.on("unhandledRejection", (reason) => {
  stderrLog("[fatal] Unhandled rejection:", sanitizeFatalError(reason))
  process.exit(1)
})

// ─── Setup mode guard ────────────────────────────────────────────────────────
// If --setup or --wizard is passed, run the onboarding wizard and exit.
// This MUST happen before any server setup to avoid polluting stdout.
const API_BASE = normalizeApiBase(
  process.env.LEADLOADZ_API_BASE || DEFAULT_API_BASE
)
const TIMEOUT_MS = parseInt(process.env.LEADLOADZ_TIMEOUT_MS || "30000", 10)

if (isSetupMode()) {
  await runSetupWizard(API_BASE, TIMEOUT_MS)
  // runSetupWizard never returns — it exits the process
}

// ─── Configuration ───────────────────────────────────────────────────────────
const API_KEY = process.env.LEADLOADZ_API_KEY

if (!API_KEY) {
  showSetupCTA()
  process.exit(1)
}

// Validate API base URL to prevent SSRF attacks
// Only allow HTTPS URLs to ensure API keys are never sent over plaintext
try {
  const parsedUrl = new URL(API_BASE)
  if (parsedUrl.protocol !== "https:") {
    stderrLog(
      "[fatal] LEADLOADZ_API_BASE must use HTTPS protocol for security.\n" +
        `Current value: ${API_BASE}\n` +
        "The API key must never be transmitted over unencrypted connections."
    )
    process.exit(1)
  }
} catch {
  stderrLog(
    "[fatal] LEADLOADZ_API_BASE is not a valid URL.\n" +
      `Current value: ${API_BASE}`
  )
  process.exit(1)
}

// ─── Telemetry ───────────────────────────────────────────────────────────────
const sessionId = generateSessionId()
const telemetry = new TelemetryTracker(sessionId, API_BASE, API_KEY)

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
    stderrLog("[warn] Failed to fetch tool list from Leadloadz API:", result.error)
    stderrLog("[warn] Using default tool configuration. API may be temporarily unavailable.")
    // Use hardcoded tools as fallback when API is rate-limited
    cachedTools = [
      {
        name: "search_leads",
        description: "Search indexed B2B contacts by role, company, location, or technology. Read-only; returns verified leads with deliverability scores. Requires API key. Rate limit: 30/min per user. Use verify_email after discovery to confirm deliverability before outreach. Supports pagination: pass search_id from a previous result to fetch the next page without consuming additional quota. Sessions expire after 5 minutes.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Specific natural-language search query. Narrow criteria yield better precision (e.g., 'CTOs at Series A B2B SaaS in London'). Required for new searches; omit when paginating with search_id." },
            limit: { type: "number", description: "Maximum results to return. Default: 10. Cap: 50. Higher values consume more quota.", minimum: 1, maximum: 50 },
            offset: { type: "number", description: "Number of results to skip for pagination. Default: 0.", minimum: 0 },
            search_id: { type: "string", description: "Session ID from a previous search_leads call. When provided, results are fetched from cache and no quota is consumed. Session expires after 5 minutes." }
          },
          required: []
        }
      },
      {
        name: "verify_email",
        description: "Check email deliverability in real-time: MX records, SMTP, disposable/role detection. Read-only. Requires API key. Rate limit: 30/min per user. Use after search_leads or before sending campaigns. Returns deliverability score and risk assessment.",
        inputSchema: {
          type: "object" as const,
          properties: {
            email: { type: "string", description: "Single email address to verify. Must be a valid RFC-like address format." }
          },
          required: ["email"]
        }
      },
      {
        name: "get_user_stats",
        description: "Read current usage counters: searches performed, emails verified, and remaining quota. Read-only. Requires API key. Rate limit: 30/min per user. Use before batch operations to check available allowance.",
        inputSchema: {
          type: "object" as const,
          properties: {}
        }
      }
    ]
    telemetry.track("tools_loaded", { count: cachedTools.length, source: "fallback" })
    return
  }
  cachedTools = result.data
  telemetry.track("tools_loaded", { count: cachedTools.length, source: "api" })
  stderrLog(`[info] Loaded ${cachedTools.length} tools from Leadloadz API`)
}

// ─── Health Check ────────────────────────────────────────────────────────────
// Validate API connectivity and credentials on startup.
async function healthCheck(): Promise<void> {
  stderrLog("[info] Performing startup health check...")
  const result = await apiClient.safeCall(() => apiClient.getServerInfo())
  if (!result.success) {
    stderrLog("[warn] Health check failed:", result.error)
    stderrLog(
      "[warn] Please verify your LEADLOADZ_API_KEY is correct and the API is accessible.\n" +
        "[warn] Get a new API key at: https://www.leadloadz.com/dashboard/api-tokens"
    )
    telemetry.track("auth_failed", { reason: "health_check_failed", error: result.error })
    return
  }
  const info = result.data
  stderrLog(`[info] Connected to Leadloadz API: ${info.name} v${info.version}`)
  stderrLog(`[info] Available tools: ${info.tools.join(", ")}`)
  stderrLog(`[info] Rate limit: ${info.usage.rate_limit}`)
  telemetry.track("server_started", { api_version: info.version, tools: info.tools.length })
}

// ─── MCP Server Setup ────────────────────────────────────────────────────────
const server = new Server(
  {
    name: "leadloadz-mcp",
    version: PACKAGE_VERSION,
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
    telemetry.track("tool_called", { tool: name, success: false, reason: "unknown_tool" })
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
    telemetry.track("tool_called", { tool: name, success: false, reason: "api_error" })
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
    telemetry.track("tool_called", { tool: name, success: false, reason: "rpc_error", code: response.error.code })
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

  // Track successful tool call
  telemetry.track("tool_called", {
    tool: name,
    success: true,
    arg_count: Object.keys(args || {}).length,
  })

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
  stderrLog("[info] Leadloadz MCP server running on stdio")
}

main().catch((err) => {
  stderrLog("[fatal] Server failed to start:", sanitizeFatalError(err))
  process.exit(1)
})
