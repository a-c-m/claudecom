#!/usr/bin/env node
import { Command } from 'commander';
import { Passthrough } from './terminal/passthrough';
import { TerminalBridge } from './bridge';
import { StandaloneBridge } from './standalone-bridge';
import { PrintModeBridge } from './print-mode-bridge';
import { createAdapter, AdapterType } from './adapters';
import { ConfigManager } from './config';

const program = new Command();

program
  .name('claudecom')
  .description('Remote communication for Claude and other terminal apps')
  .version('1.0.0')
  .option('-n, --name <name>', 'instance name')
  .option('-a, --adapter <type>', 'adapter type (slack, discord, telegram)')
  .option('-t, --transport <type>', 'transport type (file, slack, discord, telegram)')
  .option('--mcp-config <path>', 'path to MCP config file')
  .option('--config <path>', 'path to ClaudeCom config file')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'verbose logging')
  .option('--print-mode', 'use Claude print mode (recommended for file transport)')
  .helpOption('-h, --help', 'display help for command')
  .argument('[command]', 'command to run (defaults to claude)')
  .action(async (command, options) => {
    // Initialize configuration manager
    const config = new ConfigManager(options);
    
    // Check if we have valid configuration
    if (!config.isValid()) {
      process.stderr.write('Error: No transport specified.\n\n');
      process.stderr.write('Please specify a transport using one of these methods:\n');
      process.stderr.write('  1. Command line: claudecom --transport file\n');
      process.stderr.write('  2. Config file: Create claudecom.json or .claudecom.json\n');
      process.stderr.write('  3. User config: ~/.claudecom/config.json\n');
      process.stderr.write('  4. Environment: export CLAUDECOM_TRANSPORT=file\n\n');
      process.stderr.write('Example config file:\n');
      process.stderr.write('{\n');
      process.stderr.write('  "transport": "file",\n');
      process.stderr.write('  "file": {\n');
      process.stderr.write('    "inputPath": "./input.txt",\n');
      process.stderr.write('    "outputPath": "./output.txt"\n');
      process.stderr.write('  }\n');
      process.stderr.write('}\n\n');
      process.stderr.write('For more information, see: https://github.com/a-c-m/claude-com\n');
      process.exit(1);
    }
    
    // Get configuration values (CLI options override config file)
    const transportType = config.get('transport') as AdapterType;
    const instanceName = config.get('instance');
    const verbose = config.get('verbose', false);
    const printMode = config.get('printMode', false);
    
    // Debug config loading
    if (verbose) {
      process.stderr.write(`[claudecom] Config loaded: ${JSON.stringify(config.getConfig(), null, 2)}\n`);
    }
    
    // Determine if we're in piped mode or standalone mode
    const isPiped = !process.stdin.isTTY;

    if (verbose) {
      process.stderr.write(`[claudecom] Starting with instance name: ${instanceName}\n`);
      process.stderr.write(`[claudecom] Using transport: ${transportType}\n`);
      process.stderr.write(`[claudecom] Mode: ${isPiped ? 'piped' : 'standalone'}\n`);
    }

    let bridge: TerminalBridge | StandaloneBridge | PrintModeBridge | undefined;

    try {
      // Get transport-specific config
      const transportConfig = config.getTransportConfig(transportType);
      
      // Create adapter with transport-specific config
      const adapter = createAdapter(transportType, transportConfig);

      if (isPiped) {
        // Piped mode - use the original bridge
        bridge = new TerminalBridge({
          stdin: process.stdin,
          stdout: process.stdout,
          adapter,
          instanceName,
          verbose,
          noColor: options.noColor
        });
      } else if (printMode) {
        // Print mode - separate Claude invocation per command
        bridge = new PrintModeBridge({
          command: command || config.get('command', 'claude'),
          adapter,
          instanceName,
          verbose
        });
      } else {
        // Standalone mode - single Claude instance
        bridge = new StandaloneBridge({
          command: command || config.get('command', 'claude'),
          adapter,
          instanceName,
          verbose,
          transportType
        });
      }

      await bridge.start();
    } catch (error: any) {
      process.stderr.write(`[claudecom] Error: ${error.message}\n`);
      
      // Fall back to simple passthrough if adapter fails
      if (verbose) {
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
      if (verbose) {
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

// Parse arguments
program.parse(process.argv);