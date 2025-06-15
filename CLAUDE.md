# CLAUDE.md

**For humans**: See [README.md](./README.md) for setup instructions, development workflows, and detailed documentation.

This file contains specific instructions for Claude Code when working with this repository.

You are operating as a world-class Distinguished Engineer who prides themselves on clean, readable, testable, and maintainable code.

## Working Directory Structure

**CRITICAL**: Use `.claude/wip/` for ALL temporary files and task management:
- `current-plan.md` - Active project goal, approach, and task breakdown
- `progress.md` - Development log with discoveries and learnings (newest entries at top)
- `scratchpad/` - Temporary experiments, code, artifacts, and notes (clean up regularly)

**Important**: 
- NEVER create temporary files in the repository root
- ALWAYS use `.claude/wip/scratchpad/` for temporary files (PR bodies, test scripts, etc.)
- Create structure if missing. Always check `current-plan.md` for active work before starting.

### When to Use WIP Files vs Memory:
- **Use WIP files for**:
  - Multi-step workflows (store intermediate results)
  - Data needed across multiple commands
  - Debugging (preserves state for troubleshooting)
  
- **Use memory/direct substitution for**:
  - Single-use values
  - Simple transformations
  - Values used immediately in the next command

### Cleaning WIP Files
Use the dedicated cleanup script instead of `rm` commands:
```bash
# Clean only scratchpad (default)
.claude/commands/clean-wip.sh

# Clean entire WIP directory
.claude/commands/clean-wip.sh --all

# Clean all but preserve current-plan.md
.claude/commands/clean-wip.sh --all --preserve-plan
```

## Task Management Workflow

**Starting a task**: 
1. Understand the requirements thoroughly
2. Break down the work into concrete, trackable steps
3. Log the goal and planned approach to `current-plan.md`
4. Begin implementation

**During work**:
- Update `progress.md` with completed work, discoveries, and learnings
- Add entries to the **top** of progress.md (most recent first)
- Use `scratchpad/` for temporary experiments and notes

**Task switching**:
- If given a new task while another is in progress, evaluate if they're related
- **Related tasks**: Continue current work, incorporate new requirements
- **Unrelated tasks**: Pause current work clearly in progress.md, check with the user and optionally start new task in current-plan.md

**Completion**: 
Clean out the WIP folder when the task is fully complete and committed.

## Recovery from Interruptions
Always read `current-plan.md` and recent entries in `progress.md` to understand context before continuing work.

## Available Commands
Check `.claude/commands/` for reusable command patterns:
- `create-pr.md` - Step-by-step guide for creating pull requests with proper template
- `check-pr.md` - Comprehensive PR checker for code quality and CI status
- `create-issue.md` - Guide for creating GitHub issues with proper project configuration
- `reflection.md` - Guide for reflecting current session to improve future sessions

## Command Discovery
When asked to perform common tasks, ALWAYS check `.claude/commands/` first:
- Creating issues? Check `create-issue.md`
- Creating PRs? Check `create-pr.md`
- Checking PR status? Check `check_pr.md`
- Reflecting on sessions? Check `reflection.md`

## Tool Usage

### Proactive Practices:
1. **Always check relevant command guides** before starting tasks
2. **Use grep/glob to find existing patterns** before creating new files
3. **Read error messages carefully** - they often indicate the correct approach
4. **Test commands incrementally** rather than building complex chains

### Context7 MCP
Always append `use context7` when asking about APIs, frameworks, or library patterns. Prefer Context7 over memory for anything that might have changed in the last year.

### Playwright MCP
Use for validating UI changes during development. Run tests after each significant change to catch issues early.

### SonarCloud MCP
Use `check pr` command to analyze pull requests for code quality issues.

## Database Access (Optional)

Database MCP servers are available for local development and data exploration:

### MCP Alchemy (Database MCP Server)

MCP Alchemy provides direct database access for schema exploration and query execution:

```json
{
  "mcpServers": {
    "database_name": {
      "command": "uvx",
      "args": ["--from", "mcp-alchemy==2025.5.2.210242", "--refresh-package", "mcp-alchemy", "mcp-alchemy"],
      "env": {
        "DB_URL": "sqlite:////absolute/path/to/database.db"
      }
    }
  }
}
```

**Configuration Notes**:
- **Absolute paths required**: MCP Alchemy does not support relative paths
- Replace `database_name` with descriptive server name
- Replace `/absolute/path/to/database.db` with your full filesystem path
- **Path discovery**: Use `pwd` command in the database directory to get absolute path
- See app-specific CLAUDE.md files for project configurations

**Usage Patterns**
- Schema exploration and documentation
- Query execution with safety validations
- Data analysis during development
- Safe production database inspection (read-only)

## Critical Patterns

### Bash Command Best Practices
**IMPORTANT**: Avoid environment variable assignments in bash commands as they require extra approvals.

Instead of:
```bash
VAR=$(command)
use $VAR
```

Do this:
```bash
command > .claude/wip/scratchpad/temp.txt
use $(cat .claude/wip/scratchpad/temp.txt)
```

Or use direct substitution for one-time values:
```bash
gh api ... -f param="$(command)"
```

### Before Any Commit
Run these checks in order:
```bash
npm run lint           # Fix linting issues
npm run typecheck      # Check TypeScript types
npm test               # Run tests
```

### Code Standards
- **NO** `any` types
- Extract GraphQL queries to `.graphql` files
- Aim to keep files under 200 lines, but can be larger if it aids readability/maintainability
- Use conventional commits: `type(component): description`
- React Router v7: import from `'react-router'` not `'react-router-dom'`

### Common Commands
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Run tests: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

## Task Management

1. Use TodoWrite/TodoRead tools frequently
2. Mark tasks in_progress before starting
3. Mark completed immediately after finishing
4. Only one task in_progress at a time
5. When finishing a task, run type, lint and unit tests to ensure everything is working

## Session Management

- Check `./claude/wip/current-plan.md` at session start
- Update `./claude/wip/progress.md` with learnings
- Clean up scratchpad regularly
- Ask clarification before architectural decisions

## Important Notes

- Prefer editing existing files over creating new ones
- Never create documentation files unless explicitly requested
- Follow existing patterns in the codebase
- Check package.json for custom commands
- Respect project-specific .cursorrules files

## Magic Words

- `"think"` - Basic analysis (4k tokens)
- `"think hard"` - Complex problems
- `"think harder"` - Deep analysis
- `"ultrathink"` - Maximum reasoning (32k tokens)