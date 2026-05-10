# @leadloadz/mcp-server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects AI assistants to the [Leadloadz](https://www.leadloadz.com) B2B lead generation platform.

## Features

- **Search Leads** — Find verified B2B leads using natural language queries
- **Verify Email** — Real-time email verification with deliverability scoring
- **Get Stats** — Check your usage and remaining quotas

## Installation

### Via npx (recommended)

No installation required. AI clients can run the server directly:

```bash
npx -y @leadloadz/mcp-server
```

### Via npm

```bash
npm install -g @leadloadz/mcp-server
leadloadz-mcp
```

## Configuration

You need a Leadloadz API key to use this server.

1. Sign up at [leadloadz.com](https://www.leadloadz.com)
2. Go to **Dashboard → API Tokens**
3. Generate a new token
4. Copy the token value

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
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
```

### Cline (VS Code)

Add to your Cline MCP settings:

```json
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
```

### Other Clients

Any MCP client that supports stdio transport can use:

```json
{
  "command": "npx",
  "args": ["-y", "@leadloadz/mcp-server"],
  "env": {
    "LEADLOADZ_API_KEY": "your-api-key-here"
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LEADLOADZ_API_KEY` | **Yes** | — | Your Leadloadz API token |
| `LEADLOADZ_API_BASE` | No | `https://www.leadloadz.com/api/mcp` | API base URL |
| `LEADLOADZ_TIMEOUT_MS` | No | `30000` | Request timeout in milliseconds |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Test locally
node dist/index.js
```

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
