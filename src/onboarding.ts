import { spawn } from "child_process"
import * as readline from "readline"
import { stderrLog } from "./logger.js"
import { getUserAgent } from "./config.js"

const SIGNUP_URL =
  "https://www.leadloadz.com/signup?ref=mcp&utm_source=mcp-server&utm_medium=cli&utm_campaign=mcp-launch"

const SETUP_URL =
  "https://www.leadloadz.com/signup?ref=mcp-setup&utm_source=mcp-server&utm_medium=cli&utm_campaign=mcp-launch"

/**
 * Check if --setup or --wizard was passed in argv.
 */
export function isSetupMode(): boolean {
  return process.argv.slice(2).some(
    (arg) => arg === "--setup" || arg === "--wizard"
  )
}

/**
 * Print a branded signup CTA to stderr when the API key is missing.
 */
export function showSetupCTA(): void {
  const banner = `
╔══════════════════════════════════════════════════════════╗
║  Welcome to Leadloadz MCP Server                        ║
╠══════════════════════════════════════════════════════════╣
║  You need an API key to get started.                    ║
║                                                          ║
║  1. Create a free account:                              ║
║     ${SIGNUP_URL}                    ║
║                                                          ║
║  2. Go to Dashboard → API Tokens                        ║
║                                                          ║
║  3. Copy your key and set it:                           ║
║     export LEADLOADZ_API_KEY=your_key_here              ║
║                                                          ║
║  Or run: npx @leadloadz/mcp-server --setup              ║
╚══════════════════════════════════════════════════════════╝
`
  stderrLog(banner)
}

/**
 * Open a URL in the user's default browser.
 * Falls back silently if the open command fails.
 */
function openBrowser(url: string): void {
  const platform = process.platform
  const command =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open"

  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32",
  })

  child.on("error", () => {
    // Silently ignore — we'll show the URL in text anyway
  })

  child.unref()
}

/**
 * Validate an API key by pinging the Leadloadz MCP endpoint.
 */
async function validateApiKey(
  apiKey: string,
  apiBase: string,
  timeoutMs: number
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(apiBase, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": getUserAgent(),
        "X-Source": "mcp-server",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Prompt the user for input using readline.
 */
function prompt(question: string, mask = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    if (mask) {
      // For masked input (API key), use raw mode
      process.stdout.write(question)
      let input = ""

      process.stdin.on("data", (chunk: Buffer) => {
        const char = chunk.toString()
        switch (char) {
          case "\n":
          case "\r":
            process.stdout.write("\n")
            rl.close()
            resolve(input)
            break
          case "\u0003": // Ctrl+C
            process.exit(1)
            break
          case "\u007f": // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1)
              process.stdout.write("\b \b")
            }
            break
          default:
            input += char
            process.stdout.write("*")
            break
        }
      })

      if (typeof process.stdin.setRawMode === "function") {
        process.stdin.setRawMode(true)
        process.stdin.resume()

        rl.on("close", () => {
          process.stdin.setRawMode(false)
          process.stdin.pause()
        })
      }
    } else {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    }
  })
}

/**
 * Run the interactive setup wizard.
 * All output goes to stderr. Exits process when done.
 */
export async function runSetupWizard(apiBase: string, timeoutMs: number): Promise<never> {
  // Guard: must be interactive TTY
  if (!process.stdin.isTTY) {
    stderrLog(`
Interactive setup requires a terminal.

Create your free account at:
${SETUP_URL}
`)
    process.exit(0)
  }

  stderrLog(`
╔══════════════════════════════════════════════════════════╗
║  Leadloadz MCP Server — Setup Wizard                    ║
╠══════════════════════════════════════════════════════════╣
║  Let's get you connected to Leadloadz.                  ║
╚══════════════════════════════════════════════════════════╝
`)

  const hasKey = (await prompt("Do you have a Leadloadz API key? (y/n): ")).toLowerCase()

  let apiKey: string | undefined

  if (hasKey === "y" || hasKey === "yes") {
    apiKey = await prompt("Paste your API key: ", true)
  } else {
    stderrLog(`
No problem! Let's create your account.

Opening your browser to:
${SETUP_URL}
`)
    openBrowser(SETUP_URL)

    stderrLog("\nOnce you've created your account and generated an API key, paste it below.\n")
    apiKey = await prompt("Paste your API key: ", true)
  }

  if (!apiKey || apiKey.trim().length === 0) {
    stderrLog("[fatal] API key is required. Setup cancelled.")
    process.exit(1)
  }

  stderrLog("[info] Validating your API key...")

  const isValid = await validateApiKey(apiKey.trim(), apiBase, timeoutMs)

  if (!isValid) {
    stderrLog(`
[fatal] That API key doesn't seem to work.

Possible reasons:
- The key was typed incorrectly
- The key has been revoked
- The Leadloadz API is temporarily unavailable

Please try again or generate a new key at:
https://www.leadloadz.com/dashboard/api-tokens
`)
    process.exit(1)
  }

  stderrLog(`
✓ Success! Your API key is valid.

To use Leadloadz MCP Server, set this environment variable:

  export LEADLOADZ_API_KEY=${apiKey.trim()}

Or add it to your MCP client configuration (Claude Desktop, Cline, etc.).

Happy lead hunting! 🚀
`)

  process.exit(0)
}
