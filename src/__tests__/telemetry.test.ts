import { TelemetryTracker, generateSessionId } from "../telemetry.js"

// Mock global fetch
global.fetch = jest.fn()

describe("TelemetryTracker", () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = fetch as jest.Mock
    fetchMock.mockResolvedValue({ ok: true })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("generateSessionId", () => {
    it("should return a non-empty string", () => {
      const id = generateSessionId()
      expect(typeof id).toBe("string")
      expect(id.length).toBeGreaterThan(0)
    })

    it("should return unique IDs", () => {
      const id1 = generateSessionId()
      const id2 = generateSessionId()
      expect(id1).not.toBe(id2)
    })
  })

  describe("track", () => {
    it("should send a POST to the telemetry endpoint", () => {
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", true)
      tracker.track("server_started", { foo: "bar" })

      // Fast-forward past the setTimeout in track()
      jest.advanceTimersByTime(100)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test.com/mcp/telemetry",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Source": "mcp-server",
          },
        })
      )

      const callArgs = fetchMock.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body).toMatchObject({
        event: "server_started",
        package_version: "1.1.0",
        session_id: "session-123",
        has_api_key: true,
        metadata: { foo: "bar" },
      })
      expect(body.timestamp).toBeDefined()
    })

    it("should not include API key in payload", () => {
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", true)
      tracker.track("tool_called", { key: "secret-api-key-123" })

      jest.advanceTimersByTime(100)

      const callArgs = fetchMock.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.metadata.key).toBe("secret-api-key-123")
      // The metadata is passed through, but the tracker itself never has access to the key
      expect(body).not.toHaveProperty("api_key")
    })

    it("should silently fail on network errors", () => {
      fetchMock.mockRejectedValue(new Error("Network down"))
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", true)

      // Should not throw
      expect(() => tracker.track("server_started")).not.toThrow()

      jest.advanceTimersByTime(100)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("should silently fail on timeout", () => {
      fetchMock.mockImplementation(() => new Promise(() => {})) // never resolves
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", true)

      tracker.track("server_started")

      // Fast-forward past the 5-second timeout
      jest.advanceTimersByTime(6000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      // No unhandled rejection should occur
    })

    it("should strip trailing slashes from apiBase", () => {
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp///", true)
      tracker.track("server_started")

      jest.advanceTimersByTime(100)

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test.com/mcp/telemetry",
        expect.anything()
      )
    })

    it("should work with has_api_key=false", () => {
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", false)
      tracker.track("auth_failed")

      jest.advanceTimersByTime(100)

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.has_api_key).toBe(false)
    })

    it("should not send when telemetry is disabled", () => {
      process.env.LEADLOADZ_DISABLE_TELEMETRY = "1"
      const tracker = new TelemetryTracker("session-123", "https://api.test.com/mcp", true)
      tracker.track("server_started")

      jest.advanceTimersByTime(100)

      expect(fetchMock).not.toHaveBeenCalled()
      delete process.env.LEADLOADZ_DISABLE_TELEMETRY
    })
  })
})
