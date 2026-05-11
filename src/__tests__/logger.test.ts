import { stderrLog, redirectConsoleToStderr, sanitizeFatalError } from "../logger.js"

describe("logger", () => {
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  describe("stderrLog", () => {
    it("should write to stderr", () => {
      stderrLog("test message", 123)
      expect(stderrSpy).toHaveBeenCalledTimes(1)
      const output = stderrSpy.mock.calls[0][0] as string
      expect(output).toContain("test message")
      expect(output).toContain("123")
    })
  })

  describe("redirectConsoleToStderr", () => {
    it("should redirect console.log to stderr", () => {
      redirectConsoleToStderr()
      console.log("hello")
      expect(stderrSpy).toHaveBeenCalled()
      const lastCall = stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0] as string
      expect(lastCall).toContain("[log]")
      expect(lastCall).toContain("hello")
    })

    it("should redirect console.info to stderr", () => {
      redirectConsoleToStderr()
      console.info("info msg")
      expect(stderrSpy).toHaveBeenCalled()
      const lastCall = stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0] as string
      expect(lastCall).toContain("[info]")
      expect(lastCall).toContain("info msg")
    })

    it("should redirect console.warn to stderr", () => {
      redirectConsoleToStderr()
      console.warn("warning")
      expect(stderrSpy).toHaveBeenCalled()
      const lastCall = stderrSpy.mock.calls[stderrSpy.mock.calls.length - 1][0] as string
      expect(lastCall).toContain("[warn]")
      expect(lastCall).toContain("warning")
    })
  })

  describe("sanitizeFatalError", () => {
    it("should return message for Error objects", () => {
      const err = new Error("something broke")
      expect(sanitizeFatalError(err)).toBe("something broke")
    })

    it("should convert non-errors to string", () => {
      expect(sanitizeFatalError(42)).toBe("42")
      expect(sanitizeFatalError("oops")).toBe("oops")
      expect(sanitizeFatalError(null)).toBe("null")
    })
  })
})
