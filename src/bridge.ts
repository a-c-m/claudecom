import { Readable, Writable } from 'stream';
import { Passthrough } from './terminal/passthrough';
import { CommunicationAdapter } from './adapters/types';

export interface TerminalBridgeOptions {
  stdin: Readable;
  stdout: Writable;
  adapter: CommunicationAdapter;
  instanceName: string;
  verbose: boolean;
  bufferTimeout?: number;
  noColor?: boolean;
}

export class TerminalBridge {
  private passthrough?: Passthrough;
  private outputBuffer: string[] = [];
  private bufferTimer?: NodeJS.Timeout;
  private contextId?: string;
  private isRunning = false;

  constructor(private options: TerminalBridgeOptions) {}

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
      }

      // Send start message
      await this.options.adapter.sendMessage(
        this.contextId,
        `🟢 Instance started: ${this.options.instanceName}`
      );

      // Set up command handler
      this.options.adapter.onMessage((context, message) => {
        if (context === this.contextId) {
          this.handleCommand(message);
        }
      });
    } catch (error) {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Adapter initialization failed: ${error}\n`);
      }
    }

    // Set up passthrough regardless of adapter status
    this.passthrough = new Passthrough(this.options.stdin, this.options.stdout);

    // Monitor output for adapter
    this.passthrough.on('data', (chunk: Buffer) => {
      this.handleOutput(chunk);
    });

    this.passthrough.on('error', (error) => {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Passthrough error: ${error.message}\n`);
      }
    });
  }

  private handleOutput(chunk: Buffer): void {
    const text = chunk.toString();
    
    // Add to buffer
    this.outputBuffer.push(text);

    // Reset timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    // Set new timer to flush buffer
    this.bufferTimer = setTimeout(() => {
      this.flushOutputBuffer();
    }, this.options.bufferTimeout || 1000);
  }

  private async flushOutputBuffer(): Promise<void> {
    if (this.outputBuffer.length === 0 || !this.contextId) return;

    const output = this.outputBuffer.join('');
    this.outputBuffer = [];

    try {
      // Format as code block for better readability
      const formatted = '```\n' + output + '\n```';
      await this.options.adapter.sendMessage(this.contextId, formatted);
    } catch (error) {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Failed to send to adapter: ${error}\n`);
      }
    }
  }

  private handleCommand(command: string): void {
    // Echo command to terminal with adapter prefix
    const adapterName = this.options.adapter.constructor.name.replace('Adapter', '').toUpperCase();
    process.stdout.write(`\n[${adapterName}] ${command}\n`);
    
    // In future, this will inject the command via named pipe
    // For now, just echo it
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Flush any remaining output
    if (this.outputBuffer.length > 0) {
      await this.flushOutputBuffer();
    }

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

    // Clean up
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    if (this.passthrough) {
      this.passthrough.destroy();
    }

    await this.options.adapter.cleanup();
  }
}