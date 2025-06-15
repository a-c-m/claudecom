#!/usr/bin/env node
import { Command } from 'commander';
import { Passthrough } from './terminal/passthrough';

const program = new Command();

program
  .name('claudecom')
  .description('Bridge terminal apps to chat platforms')
  .version('1.0.0')
  .option('-n, --name <name>', 'instance name', process.cwd().split('/').pop() || 'default')
  .option('-a, --adapter <type>', 'adapter type (slack, discord, telegram)', 'slack')
  .option('--mcp-config <path>', 'path to MCP config file')
  .option('--config <path>', 'path to ClaudeCom config file')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'verbose logging')
  .helpOption('-h, --help', 'display help for command')
  .action(async (options) => {
    // Check if we're being piped to
    if (process.stdin.isTTY) {
      console.error('Error: claudecom must be used with piped input');
      console.error('Example: claude-code | claudecom');
      process.exit(1);
    }

    if (options.verbose) {
      process.stderr.write(`[claudecom] Starting with instance name: ${options.name}\n`);
      process.stderr.write(`[claudecom] Using adapter: ${options.adapter}\n`);
    }

    // Create passthrough for now
    const passthrough = new Passthrough(process.stdin, process.stdout);
    
    if (options.verbose) {
      passthrough.on('data', (chunk) => {
        process.stderr.write(`[claudecom] Received ${chunk.length} bytes\n`);
      });
    }

    passthrough.on('error', (err) => {
      process.stderr.write(`[claudecom] Error: ${err.message}\n`);
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      if (options.verbose) {
        process.stderr.write('[claudecom] Shutting down...\n');
      }
      passthrough.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      passthrough.destroy();
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