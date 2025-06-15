# ClaudeCom Implementation Specification

## Project: ClaudeCom - Terminal-to-Chat Bridge

A tool that bridges terminal applications (starting with Claude Code) to chat platforms for remote monitoring and control from mobile devices.

## Core Requirements

1. **Non-invasive monitoring** - Must not interfere with the terminal app's normal operation or IDE integrations
2. **Bidirectional communication** - Send terminal output to chat AND receive commands from chat
3. **Multiple instances** - Support monitoring multiple terminal sessions simultaneously
4. **Pluggable adapters** - Easy to add new chat platforms (start with Slack, design for extensibility)

## Architecture

```typescript
// Core interface for communication adapters
interface CommunicationAdapter {
  init(config: AdapterConfig): Promise<void>;
  setup(instanceName: string): Promise<SetupResult>;
  sendMessage(context: string, message: string): Promise<void>;
  onMessage(handler: (context: string, message: string) => void): void;
  cleanup(): Promise<void>;
}

interface SetupResult {
  contextId: string;  // Could be channel ID, chat ID, thread ID, etc.
  displayName: string; // Human-readable identifier
}
```

## Technology Stack

### Required Dependencies
```json
{
  "dependencies": {
    "commander": "^11.x",        // CLI framework (REQUIRED)
    "@slack/bolt": "^3.x",       // Slack adapter
    "dotenv": "^16.x",          // Environment variables
    "node-pty": "^1.x",         // Terminal emulation (if needed)
    "p-queue": "^7.x"           // Message queue/batching
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",              // Run TS directly
    "tsup": "^8.x",             // Build single file executable
    "@types/node": "^20.x"
  }
}
```

## Project Structure

```
claudecom/
├── package.json
├── tsconfig.json
├── README.md
├── .env.example
├── src/
│   ├── index.ts          # CLI entry point using Commander.js
│   ├── bridge.ts         # Main bridge orchestrator
│   ├── adapters/
│   │   ├── index.ts      # Adapter registry
│   │   ├── base.ts       # Base adapter class
│   │   ├── slack.ts      # Slack implementation
│   │   └── types.ts      # Shared types
│   ├── terminal/
│   │   ├── monitor.ts    # Terminal output monitoring
│   │   └── input.ts      # Command injection
│   └── config/
│       ├── loader.ts     # Config file loading
│       └── mcp.ts        # MCP config integration
└── dist/                 # Compiled output
```

## Implementation Details

### CLI Implementation (using Commander.js)

```typescript
// src/index.ts
import { Command } from 'commander';
import { pipeline } from 'stream';
import { TerminalBridge } from './bridge';

const program = new Command();

program
  .name('claudecom')
  .description('Bridge terminal apps to chat platforms')
  .version('1.0.0')
  .option('-n, --name <name>', 'instance name', process.cwd().split('/').pop())
  .option('-a, --adapter <type>', 'adapter type (slack, discord, telegram)', 'slack')
  .option('--mcp-config <path>', 'path to MCP config file')
  .option('--config <path>', 'path to ClaudeCom config file')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'verbose logging')
  .action(async (options) => {
    try {
      const bridge = new TerminalBridge(options);
      await bridge.start();
      
      // Pipe stdin through
      pipeline(process.stdin, bridge, process.stdout, (err) => {
        if (err) console.error('Pipeline failed:', err);
        process.exit(1);
      });
    } catch (error) {
      console.error('Failed to start:', error);
      process.exit(1);
    }
  });

program.parse();
```

### CLI Usage Examples

```bash
# Basic usage - auto-detects folder name as instance
claude-code | claudecom

# With custom instance name
claude-code | claudecom --name "backend-api"

# With specific adapter
claude-code | claudecom --adapter telegram

# Using MCP config for credentials
claudecom --mcp-config ~/.mcp/config.json

# Verbose mode for debugging
claude-code | claudecom --verbose

# Using custom config file
claudecom --config ~/.claudecom/config.json
```

### Slack Adapter Requirements

- Use @slack/bolt for Slack integration
- Create private channels for each instance: `claude-{instanceName}` join the channel it if already exists, but check for other active sessions in the channel, if you find one, error out.
- Support both Socket Mode and webhook-based connections
- Batch messages to avoid spam (1-second buffer)
- Shouldn't send messages just updating token usage count, only send messages when there is actual output or commands
- Format terminal output in code blocks with ANSI color preservation
- Handle rate limiting gracefully
- Config could be typical slack config with token, or socket mode config with app token and signing secret, or a mcp_config_path, which we then find and extract the slack config from.

### Terminal Integration

- Read from stdin for piped output
- Use node-pty for proper terminal emulation if needed
- Support command injection via:
  - Named pipes (FIFOs)
  - Tmux integration
  - Direct process control (if not piped)
- Preserve ANSI color codes where possible
- Handle binary output gracefully

### Configuration

Support multiple config sources (in priority order):
1. Command line arguments
2. Environment variables (CLAUDECOM_ADAPTER, SLACK_BOT_TOKEN, etc.)
3. Config file (`~/.claudecom/config.json`, `<project_root>/.claude-com.json` or specified via --config)
4. MCP config file (if specified via --mcp-config)

#### Config File Structure
```json
{
  "defaultAdapter": "slack",
  "adapters": {
    "slack": {
      "token": "xoxb-...",
      "signingSecret": "...",
      "appToken": "xapp-..."
    },
    "telegram": {
      "botToken": "...",
      "userId": "..."
    }
  },
  "terminal": {
    "bufferTimeout": 1000,
    "maxBufferSize": 4096,
    "preserveColors": true
  }
}
```

#### MCP Config Structure
```json
{
  "communication": {
    "slack": {
      "token": "xoxb-...",
      "signingSecret": "...",
      "appToken": "xapp-..."
    }
  }
}
```

### Key Features

1. **Instance naming**: Default to current directory name, allow override
2. **Message batching**: Buffer output for 1 second to avoid spam
3. **Error handling**: Graceful degradation if chat connection fails
4. **Status indicators**: 
   - 🟢 Instance started
   - 📝 Output activity
   - 💬 Command received
   - 🔴 Instance terminated
5. **Command echo**: Show commands from chat in terminal with `[SLACK]` prefix
6. **Reconnection**: Auto-reconnect to chat platforms on disconnect
7. **Cleanup**: Proper cleanup on SIGINT/SIGTERM

### Message Formatting

```typescript
// Terminal output to Slack
await adapter.sendMessage(contextId, '```\n' + terminalOutput + '\n```');

// Status messages
await adapter.sendMessage(contextId, '🟢 Instance started: ' + instanceName);

// Command echo in terminal
process.stdout.write(`\n[${adapter.name.toUpperCase()}] ${command}\n`);
```

### Error Handling

- Connection failures should not crash the bridge
- Log errors to stderr when in verbose mode
- Gracefully handle rate limiting
- Provide clear error messages for missing configuration

### Future Adapter Ideas

- Discord (webhook-based)
- Telegram (bot API)
- Microsoft Teams
- Generic webhook adapter
- Email digest adapter

## Technical Constraints

- TypeScript with strict mode enabled
- Node.js 18+ (for native fetch and stream improvements)
- Minimal dependencies (keep bundle size small)
- Must not interfere with terminal app's stdin/stdout when used as a pipe
- Clean shutdown on SIGINT/SIGTERM
- Single file executable output using tsup

## Build Configuration

```javascript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'node18',
  banner: {
    js: '#!/usr/bin/env node'
  }
});
```

## Success Metrics

- Zero interference with Claude Code's normal operation
- Less than 2-second latency for output streaming
- Reliable command delivery from chat
- Works on macOS, Linux, and WSL
- Bundle size under 10MB
- Startup time under 500ms

## Testing Strategy

- Unit tests for adapters and core logic
- Integration tests with mock chat platforms
- E2E tests with real Claude Code instances
- Performance tests for latency and throughput
- Cross-platform testing

## Documentation Requirements

- Comprehensive README with quick start guide
- API documentation for adapter development
- Example configurations for common use cases
- Troubleshooting guide
- Video demo of setup and usage

## Release Strategy

- NPM package: `npm install -g claudecom`
- GitHub releases with pre-built binaries
- Homebrew formula for macOS
- AUR package for Arch Linux

---

Please create this tool with clean, modular code that makes it easy to add new chat platform adapters in the future. Start with a working Slack implementation and the core bridge functionality. Use Commander.js for CLI argument parsing as specified.