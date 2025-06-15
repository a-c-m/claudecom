#!/usr/bin/env node
import { Command } from 'commander';
import { Bridge } from './bridge';
import { createTransport, TransportType } from './transports';
import { ConfigManager } from './config';

const program = new Command();

program
  .name('claudecom')
  .description('Remote communication for Claude and other terminal apps')
  .version('1.0.0')
  .option('-n, --name <name>', 'instance name')
  .option('-t, --transport <type>', 'transport type (file, slack, discord, telegram)')
  .option('--mcp-config <path>', 'path to MCP config file')
  .option('--config <path>', 'path to ClaudeCom config file')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'verbose logging')
  .helpOption('-h, --help', 'display help for command')
  .argument('[command]', 'command to run (defaults to claude)')
  .action(async (command, options) => {
    // Initialize configuration manager
    const config = new ConfigManager(options);
    
    // Show warning if no config file was found
    if (!config.hasConfigFile() && !options.transport && !process.env.CLAUDECOM_TRANSPORT) {
      process.stderr.write('⚠️  No configuration file found. Using default file transport.\n');
      process.stderr.write('   Input: ./input.txt, Output: ./output.txt\n\n');
      process.stderr.write('   To configure ClaudeCom, create a .claudecom.json file:\n');
      process.stderr.write('   {\n');
      process.stderr.write('     "transport": "file",\n');
      process.stderr.write('     "file": {\n');
      process.stderr.write('       "inputPath": "./custom-input.txt",\n');
      process.stderr.write('       "outputPath": "./custom-output.txt"\n');
      process.stderr.write('     }\n');
      process.stderr.write('   }\n\n');
    }
    
    // Get configuration values (CLI options override config file)
    const transportType = config.get('transport') as TransportType;
    const instanceName = config.get('instance');
    const verbose = config.get('verbose', false);
    
    // Debug config loading
    if (verbose) {
      process.stderr.write(`[claudecom] Config loaded: ${JSON.stringify(config.getConfig(), null, 2)}\n`);
    }
    
    if (verbose) {
      process.stderr.write(`[claudecom] Starting with instance name: ${instanceName}\n`);
      process.stderr.write(`[claudecom] Using transport: ${transportType}\n`);
    }

    let bridge: Bridge | undefined;

    try {
      // Get transport-specific config
      const transportConfig = config.getTransportConfig(transportType);
      
      // Create transport with transport-specific config
      const transport = createTransport(transportType, transportConfig);

      // Create the bridge
      bridge = new Bridge({
        command: command || config.get('command', 'claude'),
        transport,
        instanceName,
        verbose,
        transportType
      });

      await bridge.start();
    } catch (error: any) {
      process.stderr.write(`[claudecom] Error: ${error.message}\n`);
      process.exit(1);
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