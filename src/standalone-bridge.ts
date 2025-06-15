import { CommunicationAdapter } from './adapters/types';
import { ClaudePtyProcess } from './terminal/claude-pty-process';
import { ConversationLogger } from './utils/conversation-logger';

export interface StandaloneBridgeOptions {
  command?: string;
  adapter: CommunicationAdapter;
  instanceName: string;
  verbose: boolean;
  bufferTimeout?: number;
  transportType?: string;  // For display purposes
}

export class StandaloneBridge {
  private process?: ClaudePtyProcess;
  private outputBuffer: string[] = [];
  private bufferTimer?: NodeJS.Timeout;
  private contextId?: string;
  private isRunning = false;
  private conversationLogger = new ConversationLogger();
  private claudeReady = false;
  private initialOutput = '';  // Buffer initial output until ready

  constructor(private options: StandaloneBridgeOptions) {}

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initialize everything first before showing any UI
    let transportName = '';
    try {
      // Initialize adapter
      await this.options.adapter.init();
      const setupResult = await this.options.adapter.setup(this.options.instanceName);
      this.contextId = setupResult.contextId;
      
      // Get transport name for display
      const adapterType = this.options.transportType || 'file';
      if (adapterType.endsWith('.js') || adapterType.endsWith('.ts')) {
        // Custom transport - show filename
        transportName = adapterType.split('/').pop() || adapterType;
      } else {
        // Built-in transport
        transportName = adapterType;
      }

      // Set up command handler
      this.options.adapter.onMessage((context, message) => {
        if (context === this.contextId) {
          this.handleCommand(message);
        }
      });

      // Send start message
      await this.options.adapter.sendMessage(
        this.contextId,
        `🟢 Instance started: ${this.options.instanceName}`
      );
    } catch (error) {
      process.stderr.write('Error: Failed to initialize transport\n');
      if (this.options.verbose) {
        process.stderr.write(`${error}\n`);
      }
      throw error;
    }
    
    // Start the claude process with PTY
    this.process = new ClaudePtyProcess({
      command: this.options.command || 'claude',
      verbose: this.options.verbose
    });

    // Monitor output
    this.process.on('output', (data: Buffer) => {
      const text = data.toString();
      
      if (!this.claudeReady) {
        // Buffer output until Claude is ready
        this.initialOutput += text;
        
        // Check if Claude is ready (look for the prompt)
        if (this.initialOutput.includes('╰────') && this.initialOutput.includes('> ')) {
          this.claudeReady = true;
          // Clear screen and show the final Claude interface
          process.stdout.write('\x1B[2J\x1B[H'); // Clear screen and move to top
          process.stdout.write(this.initialOutput);
          this.initialOutput = ''; // Clear buffer
        }
      } else {
        // Claude is ready, pass output normally
        process.stdout.write(data);
      }
      
      // Always handle for logging
      this.handleOutput(data);
    });

    this.process.on('error', (error) => {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Process error: ${error.message}\n`);
      }
    });

    this.process.on('exit', (code) => {
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Process exited with code ${code}\n`);
      }
      this.stop();
    });

    // Set up terminal input passthrough
    this.setupTerminalInput();
    
    // Get transport-specific tips
    const tips = this.options.adapter.getInitTips?.() || [];
    
    // Show startup banner  
    process.stderr.write('\n');
    process.stderr.write('╭─────────────────────────────────────────────────╮\n');
    process.stderr.write('│    ClaudeCom - Remote Claude Communication      │\n');
    process.stderr.write('├─────────────────────────────────────────────────┤\n');
    process.stderr.write('│                                                 │\n');
    process.stderr.write('│  • Use Claude as you normally would             │\n');
    process.stderr.write(`│  • Remote access via: ${transportName.padEnd(25)} │\n`);
    
    // Add transport-specific tips
    if (tips.length > 0) {
      process.stderr.write('│                                                 │\n');
      tips.forEach(tip => {
        // Pad to 44 characters to account for the 4 spaces before
        process.stderr.write(`│    ${tip.padEnd(44)} │\n`);
      });
    }
    
    process.stderr.write('│                                                 │\n');
    process.stderr.write('│  Commands:                                      │\n');
    process.stderr.write('│  • Send "STOP" via transport to cancel          │\n');
    process.stderr.write('│  • Press Ctrl+C here to exit                    │\n');
    process.stderr.write('╰─────────────────────────────────────────────────╯\n');
    process.stderr.write('\n');
    
    // Start the process
    this.process.start();
  }
  
  private setupTerminalInput(): void {
    // Make stdin raw mode for proper key handling
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    // Pass through terminal input to Claude
    process.stdin.on('data', (data) => {
      if (this.process && this.process.pty) {
        const key = data.toString();
        
        // Check for Ctrl+C
        if (key === '\x03') {
          if (this.options.verbose) {
            process.stderr.write('\n[claudecom] Ctrl+C detected, shutting down...\n');
          }
          this.stop();
          process.exit(0);
        }
        
        // Pass raw keystrokes directly to PTY
        this.process.pty.write(key);
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

    // Check if we've received a complete response
    const fullBuffer = this.outputBuffer.join('');
    const hasPrompt = fullBuffer.includes('│ >') && fullBuffer.includes('╰─');
    const hasResponse = fullBuffer.includes('⏺');
    
    // If we have a response and see a new prompt, flush immediately
    if (hasResponse && hasPrompt && fullBuffer.endsWith('─╯\n')) {
      this.flushOutputBuffer();
    } else {
      // Use a much shorter timeout for more responsive updates
      this.bufferTimer = setTimeout(() => {
        this.flushOutputBuffer();
      }, this.options.bufferTimeout || 100); // Reduced from 500ms to 100ms
    }
  }

  private async flushOutputBuffer(): Promise<void> {
    if (this.outputBuffer.length === 0 || !this.contextId) return;

    const rawOutput = this.outputBuffer.join('');
    this.outputBuffer = [];

    // Process the output to get clean conversation content
    const conversation = this.conversationLogger.process(rawOutput);
    
    if (conversation) {
      try {
        // Send clean conversation content to adapter
        await this.options.adapter.sendMessage(this.contextId, conversation);
      } catch (error) {
        if (this.options.verbose) {
          process.stderr.write(`[claudecom] Failed to send to adapter: ${error}\n`);
        }
      }
    }
  }

  private handleCommand(command: string): void {
    // Don't echo to terminal - it will appear when we type it
    if (this.options.verbose) {
      process.stderr.write(`\n[claudecom] File command received: "${command}"\n`);
    }
    
    // Send command to claude process
    if (this.process && this.process.pty) {
      // Check for special STOP command
      if (command.trim() === 'STOP') {
        if (this.options.verbose) {
          process.stderr.write(`[claudecom] Sending ESC to stop current operation\n`);
        }
        // Send ESC key (ASCII 27 or \x1B)
        this.process.pty.write('\x1B');
        return;
      }
      
      // First, clear any existing input
      this.process.pty.write('\x15'); // Ctrl+U to clear line
      
      // Type the command
      this.process.pty.write(command);
      
      // Submit with Enter
      setTimeout(() => {
        if (this.options.verbose) {
          process.stderr.write(`[claudecom] Submitting command with Enter\n`);
        }
        this.process!.pty!.write('\r');
      }, 50);
    } else {
      if (this.options.verbose) {
        process.stderr.write('[claudecom] Error: Claude process not running\n');
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Restore terminal state
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    // Clear any pending timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    // Flush any remaining output immediately
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

    if (this.process) {
      this.process.stop();
    }

    await this.options.adapter.cleanup();
  }
}