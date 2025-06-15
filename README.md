# ClaudeCom

## Disclaimer

**This project is NOT affiliated with, endorsed by, or associated with Anthropic or Claude in any way.** This is an independent research project created to explore terminal-to-chat bridging capabilities. 

- This project will be immediately removed upon request from Anthropic
- All trademarks and product names are the property of their respective owners
- Use at your own risk - this is experimental software
- The author assumes no liability for any damages arising from the use of this software

This project is intended solely as a research tool and learning resource for the developer community.

Running a claude instance via slack is probably a bad idea :) 

Enjoy.

---

**Project Status: Abandoned** - This approach proved more complex than anticipated. See [Project Learnings](#project-learnings) below.

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

❌ **Project Abandoned** - The implementation complexity of handling Claude's output streams for both local CLI and remote transport systems proved challenging. The project is being abandoned in favor of a simpler approach focused on notifications and SSH access.

## Project Learnings

### Why This Approach Was Abandoned

1. **Output Complexity**: Claude's output includes complex formatting, ANSI escape codes, interactive prompts, and permission dialogs that are difficult to parse and transform reliably across different transport mechanisms.

2. **Bidirectional Communication**: Managing the bidirectional flow between the terminal application and remote chat systems while preserving the interactive nature of the CLI proved overly complex.

3. **State Management**: Maintaining consistent state between the local terminal session and remote views required significant architectural overhead.

4. **Permission Handling**: Claude's permission dialogs and interactive elements don't translate well to non-terminal environments without significant adaptation.

### Next Steps

The learnings from this project are being applied to a simpler approach that focuses on:
- **Notifications**: Simple alerts for important events
- **SSH Access**: Direct terminal access when needed
- **Less abstraction**: Working with the terminal's natural interface rather than trying to transform it

## License

MIT