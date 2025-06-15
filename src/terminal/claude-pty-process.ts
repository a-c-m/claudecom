import * as pty from 'node-pty';
import { EventEmitter } from 'events';

export interface ClaudePtyProcessOptions {
  command?: string;
  args?: string[];
  verbose?: boolean;
}

export class ClaudePtyProcess extends EventEmitter {
  private _pty?: pty.IPty;
  private isRunning = false;
  
  get pty(): pty.IPty | undefined {
    return this._pty;
  }

  constructor(private options: ClaudePtyProcessOptions = {}) {
    super();
  }

  start(): void {
    if (this.isRunning) return;

    const command = this.options.command || 'claude';
    const args = this.options.args || [];

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Starting ${command} with PTY\n`);
    }

    // Create a pseudo-terminal for Claude
    this._pty = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: process.cwd(),
      env: process.env
    });

    this.isRunning = true;

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Claude PTY started with PID ${this._pty.pid}\n`);
    }

    // Handle output from Claude
    this._pty.onData((data: string) => {
      this.emit('output', Buffer.from(data));
      // Also write to stdout so user can see it
      process.stdout.write(data);
    });

    // Handle process exit
    this._pty.onExit((exitEvent: {exitCode: number, signal?: number}) => {
      this.isRunning = false;
      this.emit('exit', exitEvent.exitCode);
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Process exited with code ${exitEvent.exitCode}, signal ${exitEvent.signal}\n`);
      }
    });

    // Handle terminal resize
    process.stdout.on('resize', () => {
      if (this._pty && this.isRunning) {
        this._pty.resize(
          process.stdout.columns || 80,
          process.stdout.rows || 24
        );
      }
    });
  }

  sendInput(input: string): void {
    if (!this._pty || !this.isRunning) {
      if (this.options.verbose) {
        process.stderr.write('[claudecom] Cannot send input - PTY not running\n');
      }
      return;
    }

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Sending input to Claude PTY: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}\n`);
    }

    // Clear any existing input first with Ctrl+A and Ctrl+K
    this._pty.write('\x01'); // Ctrl+A (move to beginning)
    this._pty.write('\x0B'); // Ctrl+K (kill to end of line)
    
    // Send the input
    this._pty.write(input);
    
    // Submit with Enter
    this._pty.write('\r');
    
    if (this.options.verbose) {
      process.stderr.write('[claudecom] Input submitted to Claude\n');
    }
  }

  stop(): void {
    if (!this._pty || !this.isRunning) return;

    this._pty.kill();
    this.isRunning = false;
  }
}