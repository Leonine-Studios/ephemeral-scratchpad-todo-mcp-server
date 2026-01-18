# Plan and Act MCP

Plan, review, run!  
Bringing Cursor's planning capabilities for any LLM.

## Features

- **Session-based architecture** — Each agent gets an isolated workspace with unique NanoID
- **Scratchpad** — Document-based working memory for notes and reasoning trails
- **Todo list** — Atomic CRUD operations for task tracking
- **X-User-ID security** — Optional header binding for multi-user environments (LibreChat compatible)
- **TONL/JSON encoding** — Token-efficient response format (30-60% reduction)
- **Storage backends** — In-memory (default) or Redis for distributed deployments
- **TTL cleanup** — Automatic session expiration

## Quick Start (Docker)

The fastest way to get running with Redis persistence:

```bash
docker compose up -d
```

This pulls the public image from GHCR and starts the MCP server with Redis.

**Endpoints:**
- MCP: `http://localhost:3000/mcp`
- Health: `http://localhost:3000/health`

## Development

### Local Development

```bash
npm install
npm run dev
```

### Development with Redis

Use Docker for Redis while developing locally:

```bash
# Start Redis only
docker compose up -d redis

# Run server locally connecting to Redis
STORAGE_TYPE=redis npm run dev
```

### Docker Development Build

Build and run locally with Docker:

```bash
# Build local image
docker build -t mcp-scratchpad-todo .

# Run with docker-compose.dev.yml (builds from source)
docker compose -f docker-compose.dev.yml up -d
```

## Configuration

Create a `.env` file or set environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `localhost` | Server host (use `0.0.0.0` for Docker) |
| `STORAGE_TYPE` | `memory` | `memory` or `redis` |
| `SESSION_TTL_HOURS` | `24` | Session lifetime before auto-cleanup |
| `RESPONSE_FORMAT` | `json` | `json` or `tonl` (token-optimized) |
| `NANOID_LENGTH` | `21` | Session ID length |
| `REDIS_HOST` | `localhost` | Redis host (when `STORAGE_TYPE=redis`) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |

## Available Tools

| Tool | Description |
|------|-------------|
| `init_session` | Create a new session, returns `session_id` |
| `read_scratchpad` | Read scratchpad content |
| `write_scratchpad` | Replace scratchpad content |
| `add_todo` | Add a todo with title, description, tags |
| `list_todos` | List todos (filter: `all`, `pending`, `done`) |
| `update_todo` | Update todo status (`pending`, `done`) |
| `delete_todo` | Delete a todo by ID |

All tools require `session_id` (except `init_session`).

## Example: Structured Research Agent

```
You do web research for a User.

**CRITICAL:**
At start of an interaction: 
1. init_session
2. write startup todos
Never stop with execution until all todos are done.

**Todos:**
1. Clarify requirements with user → write specs to scratchpad
2. Perform research based on specs
3. perform youtube search about talk shows and discussed points on the research topic
4. get 3 transcripts of the discussions to get detailed talking points
5. Output results in agreed format and sources. include talking points from the people in the talkshow

**Scratchpad:** Store user requirements, track search relevance, draft output before presenting. Review scratchpad before final delivery to ensure alignment with original specs.

You are now being connected with a user.
```

## Integrations

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "scratchpad-todo": {
      "type": "url",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### LibreChat

Add to `librechat.yaml`:

```yaml
mcp:
  scratchpad-todo:
    url: http://localhost:3000/mcp
    headers:
      X-User-ID: "{{LIBRECHAT_USER_ID}}"
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "scratchpad-todo": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## X-User-ID Security

For multi-user environments, pass `X-User-ID` header to bind sessions to users:

- Sessions created **with** `X-User-ID` require the same header on all subsequent requests
- Sessions created **without** it have no header validation (backwards compatible)

## TONL Format

TONL (Token-Optimized Notation Language) reduces token usage by 30-60%. Enable with `RESPONSE_FORMAT=tonl`.

Example todo list in TONL:
```
[2]{id, title, status, tags}
abc123   Task 1   done      [backend]
def456   Task 2   pending   []
```

## Storage Backends

| Backend | Best For | Notes |
|---------|----------|-------|
| **memory** | Development, single-instance | Data lost on restart |
| **redis** | Production, multi-instance | Persistent, native TTL |

## Testing

```bash
npm test           # Run tests
npm run test:watch # Watch mode
```

## Attribution

Inspired by the [Plan and Act](https://arxiv.org/html/2503.09572v3) Paper
and [Cursor's planning mode](https://cursor.com/blog/plan-mode)

## License

MIT
