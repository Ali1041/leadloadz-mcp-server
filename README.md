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

## Tools

### search_leads

Search indexed B2B contacts by role, company, location, or technology.

**Parameters:**
- `query` (string, required): Specific natural-language search query
- `limit` (number, optional): Max results. Default: 10, Cap: 50

**Returns:** Verified leads with deliverability scores

### verify_email

Check email deliverability in real-time.

**Parameters:**
- `email` (string, required): Email address to verify

**Returns:** Deliverability score and risk assessment

### get_user_stats

Read current usage counters.

**Returns:** Searches performed, emails verified, and remaining quota

## Security

- Your API key is never logged or exposed in error messages
- All errors are sanitized to prevent information leakage
- Communication with Leadloadz APIs uses HTTPS

## Support

- Website: [leadloadz.com](https://www.leadloadz.com)
- Issues: [GitHub Issues](https://github.com/Ali1041/leadloadz-mcp-server/issues)

## License

MIT
