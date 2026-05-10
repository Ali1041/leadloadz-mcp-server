# @leadloadz/mcp-server


[![leadloadz-mcp-server MCP server](https://glama.ai/mcp/servers/Ali1041/leadloadz-mcp-server/badges/card.svg)](https://glama.ai/mcp/servers/Ali1041/leadloadz-mcp-server) [![leadloadz-mcp-server MCP server](https://glama.ai/mcp/servers/Ali1041/leadloadz-mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/Ali1041/leadloadz-mcp-server)
A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects AI assistants to the [Leadloadz](https://www.leadloadz.com) B2B lead generation platform.

## Features

- **Search Leads** — Find verified B2B leads using natural language queries
- **Verify Email** — Real-time email verification with deliverability scoring
- **Get Stats** — Check your usage and remaining quotas

## Installation

### Via npx (recommended)

No installation required. AI clients can run the server directly:

\`\`\`bash
npx -y @leadloadz/mcp-server
\`\`\`

### Via npm

\`\`\`bash
npm install -g @leadloadz/mcp-server
leadloadz-mcp
\`\`\`

## Configuration

You need a Leadloadz API key to use this server.

1. Sign up at [leadloadz.com](https://www.leadloadz.com)
2. Go to **Dashboard → API Tokens**
3. Generate a new token
4. Copy the token value

### Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "leadloadz": {
      "command": "npx",
      "args": ["-y", "@leadloadz/mcp-server"],
      "env": {
        "LEADLOADZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
\`\`\`

### Cline (VS Code)

Add to your Cline MCP settings:

\`\`\`json
{
  "mcpServers": {
    "leadloadz": {
      "command": "npx",
      "args": ["-y", "@leadloadz/mcp-server"],
      "env": {
        "LEADLOADZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
\`\`\`

### Other Clients

Any MCP client that supports stdio transport can use:

\`\`\`json
{
  "command": "npx",
  "args": ["-y", "@leadloadz/mcp-server"],
  "env": {
    "LEADLOADZ_API_KEY": "your-api-key-here"
  }
}
\`\`\`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| \`LEADLOADZ_API_KEY\` | **Yes** | — | Your Leadloadz API token |
| \`LEADLOADZ_API_BASE\` | No | \`https://www.leadloadz.com/api/mcp\` | API base URL |
| \`LEADLOADZ_TIMEOUT_MS\` | No | \`30000\` | Request timeout in milliseconds |

## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Test locally
node dist/index.js
\`\`\`

## Publishing Changes (IMPORTANT — READ THIS)

### When to Publish

Publish a new version whenever you:
- **Add new tools** or change existing tool schemas
- **Change API endpoint behavior** that affects MCP responses
- **Fix bugs** in the MCP server code
- **Update dependencies** (especially \`@modelcontextprotocol/sdk\`)
- **Change environment variables** or configuration options

**Do NOT publish** for changes to:
- The main Leadloadz web app (this is a separate codebase)
- API routes in the Next.js app (the MCP server proxies to those)
- Database schemas (handled by the main app)
- UI components or marketing pages

### How to Publish

#### Step 1: Make your code changes
Edit files in \`src/\` as needed. Test locally:
\`\`\`bash
npm run build
npm test
\`\`\`

#### Step 2: Update version
\`\`\`bash
npm version patch   # for bug fixes
npm version minor   # for new features
npm version major   # for breaking changes
\`\`\`

#### Step 3: Update server.json
If you changed the version, update \`server.json\` to match:
\`\`\`json
{
  "version": "1.0.X",
  "packages": [
    {
      "version": "1.0.X"
    }
  ]
}
\`\`\`

#### Step 4: Commit and push to GitHub
\`\`\`bash
git add .
git commit -m "Describe your changes"
git push origin master
\`\`\`

#### Step 5: Publish to npm
\`\`\`bash
echo "//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN" > .npmrc
npm publish --access public
rm -f .npmrc
\`\`\`

**Note:** The npm token starts with \`npm_\`. Keep it secure and never commit it.

#### Step 6: Re-publish to Anthropic MCP Registry
The Anthropic MCP Registry needs to be updated whenever you publish a new npm version:

\`\`\`bash
# Login (token expires, so you may need to do this each time)
./mcp-publisher login github

# Follow the device auth flow:
# 1. Go to https://github.com/login/device
# 2. Enter the code shown
# 3. Authorize the application

# Publish
./mcp-publisher publish
\`\`\`

**Critical:** The \`mcpName\` in \`package.json\` MUST match the \`name\` in \`server.json\` exactly (case-sensitive). Currently both use \`io.github.Ali1041/leadloadz\`.

### Where It's Published

| Platform | URL | Purpose |
|----------|-----|---------|
| **npm** | https://www.npmjs.com/package/@leadloadz/mcp-server | Package distribution |
| **GitHub** | https://github.com/Ali1041/leadloadz-mcp-server | Source code |
| **Anthropic MCP Registry** | https://registry.modelcontextprotocol.io | Official Anthropic directory |
| **Glama.ai** | https://glama.ai/mcp/servers | Community directory |
| **PulseMCP** | https://www.pulsemcp.com | Community directory |
| **Smithery.ai** | https://smithery.ai | Community directory |
| **MCP.Directory** | https://mcp.directory | Community directory |

### Troubleshooting Publishing

**"Token expired" error:**
- Re-run \`./mcp-publisher login github\`

**"You do not have permission" error:**
- Make sure \`server.json\` name matches your GitHub username case: \`io.github.Ali1041/leadloadz\`
- Make sure \`package.json\` mcpName matches exactly

**"Validation failed" error:**
- Description must be ≤ 100 characters
- All required fields in \`server.json\` must be present
- npm package must already be published with the matching version

## Security

- Your API key is never logged or exposed in error messages
- All errors are sanitized to prevent information leakage
- The server communicates directly with Leadloadz APIs over HTTPS
- Rate limits are enforced by the Leadloadz API

## Support

- Website: [leadloadz.com](https://www.leadloadz.com)
- Issues: [GitHub Issues](https://github.com/Ali1041/leadloadz-mcp-server/issues)
- Email: support@leadloadz.com

## License

MIT
