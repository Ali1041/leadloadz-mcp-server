import { isSetupMode, showSetupCTA } from "../onboarding.js"
import { stderrLog } from "../logger.js"

// Mock logger
jest.mock("../logger.js", () => ({
  stderrLog: jest.fn(),
}))

describe("onboarding", () => {
  const mockedStderrLog = stderrLog as jest.MockedFunction<typeof stderrLog>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("isSetupMode", () => {
    it("should return true when --setup is in argv", () => {
      process.argv = ["node", "index.js", "--setup"]
      expect(isSetupMode()).toBe(true)
    })

    it("should return true when --wizard is in argv", () => {
      process.argv = ["node", "index.js", "--wizard"]
      expect(isSetupMode()).toBe(true)
    })

    it("should return false when no setup flag is present", () => {
      process.argv = ["node", "index.js"]
      expect(isSetupMode()).toBe(false)
    })
  })

  describe("showSetupCTA", () => {
    it("should print branded banner to stderr", () => {
      showSetupCTA()
      expect(mockedStderrLog).toHaveBeenCalledTimes(1)
      const output = mockedStderrLog.mock.calls[0][0] as string
      expect(output).toContain("Welcome to Leadloadz MCP Server")
      expect(output).toContain("leadloadz.com/signup")
      expect(output).toContain("utm_source=mcp-server")
      expect(output).toContain("npx @leadloadz/mcp-server --setup")
    })

    it("should include UTM parameters in signup URL", () => {
      showSetupCTA()
      const output = mockedStderrLog.mock.calls[0][0] as string
      expect(output).toContain("utm_source=mcp-server")
      expect(output).toContain("utm_medium=cli")
      expect(output).toContain("utm_campaign=mcp-launch")
    })
  })
})
