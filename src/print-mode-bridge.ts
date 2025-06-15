import { CommunicationAdapter } from './adapters/types';
import { ClaudeCommand } from './terminal/claude-command';

export interface PrintModeBridgeOptions {
  command?: string;
  adapter: CommunicationAdapter;
  instanceName: string;
  verbose: boolean;
  outputFormat?: 'text' | 'json' | 'stream-json';
}

export class PrintModeBridge {
  private claudeCommand: ClaudeCommand;
  private contextId?: string;
  private isRunning = false;
  private commandQueue: string[] = [];
  private isProcessing = false;

  constructor(private options: PrintModeBridgeOptions) {
    this.claudeCommand = new ClaudeCommand({
      command: options.command,
      outputFormat: options.outputFormat,
      verbose: options.verbose
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Initialize adapter
      await this.options.adapter.init();
      const setupResult = await this.options.adapter.setup(this.options.instanceName);
      this.contextId = setupResult.contextId;

      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Adapter initialized: ${setupResult.displayName}\n`);
        process.stderr.write(`[claudecom] Using Claude in print mode\n`);
      }

      // Send start message
      await this.options.adapter.sendMessage(
        this.contextId,
        `🟢 Instance started: ${this.options.instanceName} (print mode)`
      );

      // Set up command handler
      this.options.adapter.onMessage((context, message) => {
        if (context === this.contextId) {
          this.queueCommand(message);
        }
      });

      // Monitor Claude output
      this.claudeCommand.on('output', (data: Buffer) => {
        // Output is already passed through to terminal by ClaudeCommand
        // Just log to adapter
        if (this.contextId) {
          const text = data.toString();
          this.options.adapter.sendMessage(this.contextId, '```\n' + text + '\n```').catch(err => {
            if (this.options.verbose) {
              process.stderr.write(`[claudecom] Failed to send to adapter: ${err}\n`);
            }
          });
        }
      });

    } catch (error) {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Adapter initialization failed: ${error}\n`);
      }
      throw error;
    }

    // Start processing commands
    this.processQueue();
  }

  private queueCommand(command: string): void {
    this.commandQueue.push(command);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.commandQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.commandQueue.length > 0 && this.isRunning) {
      const command = this.commandQueue.shift()!;
      
      // Echo command to terminal
      const adapterName = this.options.adapter.constructor.name.replace('Adapter', '').toUpperCase();
      process.stdout.write(`\n[${adapterName}] ${command}\n\n`);
      
      try {
        // Execute command with Claude
        await this.claudeCommand.execute(command);
        
        // Add a separator for clarity
        process.stdout.write('\n---\n');
      } catch (error) {
        process.stderr.write(`[claudecom] Error executing command: ${error}\n`);
      }
    }
    
    this.isProcessing = false;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Send stop message
    if (this.contextId) {
      try {
        await this.options.adapter.sendMessage(
          this.contextId,
          `🔴 Instance terminated: ${this.options.instanceName}`
        );
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    await this.options.adapter.cleanup();
  }
}