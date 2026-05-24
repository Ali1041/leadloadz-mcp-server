import { DEFAULT_API_BASE, normalizeApiBase, PACKAGE_VERSION } from "../config.js"

describe("config", () => {
  it("reads package version from package.json", () => {
    expect(PACKAGE_VERSION).toBe("1.1.3")
  })

  it("uses non-www production default", () => {
    expect(DEFAULT_API_BASE).toBe("https://leadloadz.com/api/mcp")
    expect(DEFAULT_API_BASE).not.toContain("www.")
  })

  it("rewrites www.leadloadz.com to avoid auth-stripping redirects", () => {
    expect(normalizeApiBase("https://www.leadloadz.com/api/mcp")).toBe(
      "https://leadloadz.com/api/mcp"
    )
  })

  it("strips trailing slashes", () => {
    expect(normalizeApiBase("https://leadloadz.com/api/mcp/")).toBe(
      "https://leadloadz.com/api/mcp"
    )
  })
})
