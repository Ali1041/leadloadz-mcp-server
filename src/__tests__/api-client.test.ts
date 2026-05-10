import { LeadloadzAPIClient } from "../api-client.js"
import { MCPErrorCode } from "../types.js"

// Mock global fetch
global.fetch = jest.fn()

const TEST_API_KEY = "llz_test_api_key_12345"
const TEST_BASE_URL = "https://api.test.leadloadz.com/mcp"

function createClient(timeoutMs = 5000) {
  return new LeadloadzAPIClient({
    baseUrl: TEST_BASE_URL,
    apiKey: TEST_API_KEY,
    timeoutMs,
  })
}

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const jsonFn = response.json || jest.fn().mockResolvedValue({})
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    statusText: response.statusText ?? "OK",
    headers: response.headers ?? new Headers(),
    json: jsonFn,
    text: jest.fn().mockResolvedValue(""),
  })
}

describe("LeadloadzAPIClient", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("getServerInfo", () => {
    it("should fetch server info successfully", async () => {
      const mockInfo = {
        name: "Leadloadz MCP Server",
        version: "1.0.0",
        protocol: "2024-11-05",
        tools: ["search_leads", "verify_email", "get_user_stats"],
        transport: ["stdio", "http"],
        usage: {
          rate_limit: "30 requests per minute per user",
          ip_rate_limit: "60 requests per minute per IP",
        },
      }

      mockFetch({ ok: true, json: () => Promise.resolve(mockInfo) })

      const client = createClient()
      const result = await client.getServerInfo()

      expect(result).toEqual(mockInfo)
      expect(fetch).toHaveBeenCalledWith(
        TEST_BASE_URL,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: `Bearer ${TEST_API_KEY}`,
            "Content-Type": "application/json",
          }),
        })
      )
    })

    it("should throw on 401 authentication failure", async () => {
      mockFetch({ ok: false, status: 401 })

      const client = createClient()
      await expect(client.getServerInfo()).rejects.toThrow(
        "Authentication failed"
      )
    })

    it("should throw on other HTTP errors", async () => {
      mockFetch({ ok: false, status: 500 })

      const client = createClient()
      await expect(client.getServerInfo()).rejects.toThrow(
        "Leadloadz API returned status 500"
      )
    })

    it("should include User-Agent header", async () => {
      mockFetch({ ok: true, json: () => Promise.resolve({}) })

      const client = createClient()
      await client.getServerInfo()

      const callArgs = (fetch as jest.Mock).mock.calls[0]
      expect(callArgs[1].headers).toHaveProperty(
        "User-Agent",
        "leadloadz-mcp-server/1.0.0"
      )
    })
  })

  describe("listTools", () => {
    it("should fetch tools list successfully", async () => {
      const mockTools = [
        {
          name: "search_leads",
          description: "Search for leads",
          inputSchema: { type: "object", properties: {}, required: ["query"] },
        },
      ]

      mockFetch({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: "2.0", result: { tools: mockTools } }),
      })

      const client = createClient()
      const tools = await client.listTools()

      expect(tools).toEqual(mockTools)
      expect(fetch).toHaveBeenCalledWith(
        TEST_BASE_URL,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("tools/list"),
        })
      )
    })

    it("should handle JSON-RPC error in response", async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal error" },
          }),
      })

      const client = createClient()
      await expect(client.listTools()).rejects.toThrow("Internal error")
    })

    it("should return empty array when no tools in response", async () => {
      mockFetch({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: "2.0", result: { tools: undefined } }),
      })

      const client = createClient()
      const tools = await client.listTools()

      expect(tools).toEqual([])
    })
  })

  describe("callTool", () => {
    it("should call a tool successfully", async () => {
      const mockResult = {
        leads: [{ name: "John Doe", title: "CTO" }],
        total: 1,
      }

      mockFetch({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: "2.0", id: 1, result: mockResult }),
      })

      const client = createClient()
      const response = await client.callTool("search_leads", {
        query: "CTOs in London",
        limit: 10,
      })

      expect(response.result).toEqual(mockResult)
      expect(fetch).toHaveBeenCalledWith(
        TEST_BASE_URL,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("search_leads"),
        })
      )
    })

    it("should handle HTTP 401 error", async () => {
      mockFetch({ ok: false, status: 401 })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(MCPErrorCode.InternalError)
      expect(response.error?.message).toContain("Authentication failed")
    })

    it("should handle HTTP 403 error", async () => {
      mockFetch({ ok: false, status: 403 })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error?.message).toContain("Access denied")
    })

    it("should handle HTTP 429 rate limit error", async () => {
      mockFetch({ ok: false, status: 429 })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error?.message).toContain("Rate limit exceeded")
    })

    it("should handle HTTP 500+ server errors", async () => {
      mockFetch({ ok: false, status: 503 })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error?.message).toContain("temporarily unavailable")
    })

    it("should handle unknown HTTP errors", async () => {
      mockFetch({ ok: false, status: 418 })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error?.message).toContain("status 418")
    })

    it("should handle invalid JSON response", async () => {
      mockFetch({
        ok: true,
        json: () => Promise.reject(new Error("Unexpected token < in JSON")),
      })

      const client = createClient()
      const response = await client.callTool("search_leads", { query: "test" })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toContain("invalid response")
    })
  })

  describe("safeCall", () => {
    it("should return success for successful operations", async () => {
      const client = createClient()
      const result = await client.safeCall(() => Promise.resolve("data"))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe("data")
      }
    })

    it("should return error for failed operations", async () => {
      const client = createClient()
      const result = await client.safeCall(() =>
        Promise.reject(new Error("Something went wrong"))
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("Something went wrong")
      }
    })

    it("should sanitize API key from error messages", async () => {
      const client = createClient()
      const result = await client.safeCall(() =>
        Promise.reject(
          new Error(`Request failed with key: ${TEST_API_KEY}`)
        )
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).not.toContain(TEST_API_KEY)
        expect(result.error).toContain("[REDACTED]")
      }
    })

    it("should sanitize URLs from error messages", async () => {
      const client = createClient()
      const result = await client.safeCall(() =>
        Promise.reject(
          new Error("Failed to connect to https://internal.api.secret.com/data")
        )
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).not.toContain("https://internal.api.secret.com")
        expect(result.error).toContain("[URL_REDACTED]")
      }
    })

    it("should handle API key with special regex characters", async () => {
      const specialKey = "key.with[special]chars+"
      const specialClient = new LeadloadzAPIClient({
        baseUrl: TEST_BASE_URL,
        apiKey: specialKey,
        timeoutMs: 5000,
      })

      const result = await specialClient.safeCall(() =>
        Promise.reject(new Error(`Error with key: ${specialKey}`))
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).not.toContain(specialKey)
        expect(result.error).toContain("[REDACTED]")
      }
    })
  })

  describe("timeout handling", () => {
    it("should timeout slow requests", async () => {
      // Mock fetch that throws AbortError (simulating abort controller timeout)
      const abortError = new Error("The operation was aborted")
      abortError.name = "AbortError"
      ;(fetch as jest.Mock).mockRejectedValue(abortError)

      const client = createClient(100) // 100ms timeout
      const result = await client.safeCall(() => client.getServerInfo())

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("timed out")
      }
    })
  })
})
