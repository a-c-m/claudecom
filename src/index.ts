#!/usr/bin/env node
import { Command } from 'commander';
import { Passthrough } from './terminal/passthrough';
import { TerminalBridge } from './bridge';
import { StandaloneBridge } from './standalone-bridge';
import { PrintModeBridge } from './print-mode-bridge';
import { createAdapter, AdapterType } from './adapters';

const program = new Command();

program
  .name('claudecom')
  .description('Bridge terminal apps to chat platforms')
  .version('1.0.0')
  .option('-n, --name <name>', 'instance name', process.cwd().split('/').pop() || 'default')
  .option('-a, --adapter <type>', 'adapter type (slack, discord, telegram)', 'slack')
  .option('-t, --transport <type>', 'transport type (file, slack, discord, telegram)', 'slack')
  .option('--mcp-config <path>', 'path to MCP config file')
  .option('--config <path>', 'path to ClaudeCom config file')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'verbose logging')
  .option('--print-mode', 'use Claude print mode (recommended for file transport)')
  .helpOption('-h, --help', 'display help for command')
  .argument('[command]', 'command to run (defaults to claude)')
  .action(async (command, options) => {
    // Use transport if specified, otherwise fall back to adapter for backwards compatibility
    const transportType = (options.transport || options.adapter) as AdapterType;
    
    // Determine if we're in piped mode or standalone mode
    const isPiped = !process.stdin.isTTY;

    if (options.verbose) {
      process.stderr.write(`[claudecom] Starting with instance name: ${options.name}\n`);
      process.stderr.write(`[claudecom] Using transport: ${transportType}\n`);
      process.stderr.write(`[claudecom] Mode: ${isPiped ? 'piped' : 'standalone'}\n`);
    }

    let bridge: TerminalBridge | StandaloneBridge | PrintModeBridge | undefined;

    try {
      // Create adapter based on transport type
      const adapter = createAdapter(transportType);

      if (isPiped) {
        // Piped mode - use the original bridge
        bridge = new TerminalBridge({
          stdin: process.stdin,
          stdout: process.stdout,
          adapter,
          instanceName: options.name,
          verbose: options.verbose,
          noColor: options.noColor
        });
      } else if (options.printMode) {
        // Print mode - separate Claude invocation per command
        bridge = new PrintModeBridge({
          command: command || 'claude',
          adapter,
          instanceName: options.name,
          verbose: options.verbose
        });
      } else {
        // Standalone mode - single Claude instance
        bridge = new StandaloneBridge({
          command: command || 'claude',
          adapter,
          instanceName: options.name,
          verbose: options.verbose
        });
      }

      await bridge.start();

      if (transportType === 'file') {
        process.stderr.write(`[claudecom] File transport initialized\n`);
        process.stderr.write(`[claudecom] Input:  .claude/wip/scratchpad/input.txt\n`);
        process.stderr.write(`[claudecom] Output: .claude/wip/scratchpad/output.txt\n`);
        process.stderr.write(`[claudecom] Edit input.txt to send commands\n`);
      }
    } catch (error: any) {
      process.stderr.write(`[claudecom] Error: ${error.message}\n`);
      
      // Fall back to simple passthrough if adapter fails
      if (options.verbose) {
        process.stderr.write(`[claudecom] Falling back to simple passthrough\n`);
      }
      
      const passthrough = new Passthrough(process.stdin, process.stdout);
      
      passthrough.on('error', (err) => {
        process.stderr.write(`[claudecom] Passthrough error: ${err.message}\n`);
        process.exit(1);
      });
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      if (options.verbose) {
        process.stderr.write('[claudecom] Shutting down...\n');
      }
      if (bridge) {
        await bridge.stop();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      if (bridge) {
        await bridge.stop();
      }
      process.exit(0);
    });
  });

// Parse arguments first
program.parse(process.argv);

// If no command was triggered and no piped input, show help
if (process.argv.length === 2 && process.stdin.isTTY) {
  program.outputHelp();
  process.exit(0);
}