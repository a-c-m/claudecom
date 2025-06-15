# ClaudeCom

Terminal-to-chat bridge for remote monitoring and control of terminal applications.

## Installation

```bash
npm install -g claudecom
```

## Quick Start

```bash
# Basic usage - monitor Claude Code
claude-code | claudecom

# With custom instance name
claude-code | claudecom --name "backend-api"

# With specific adapter
claude-code | claudecom --adapter telegram
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture

ClaudeCom acts as a bridge between terminal applications and chat platforms. It:

1. Reads output from stdin (piped from terminal apps)
2. Forwards output to configured chat platforms
3. Receives commands from chat
4. Injects commands back to the terminal app via named pipes (FIFOs)

## Current Status

🚧 This project is under active development. Core piping functionality is being implemented.

## License

MIT