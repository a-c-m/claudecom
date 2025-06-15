import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeProcessOptions {
  command?: string;
  args?: string[];
  verbose?: boolean;
}

export class ClaudeProcess extends EventEmitter {
  private process?: ChildProcess;
  private isRunning = false;

  constructor(private options: ClaudeProcessOptions = {}) {
    super();
  }

  start(): void {
    if (this.isRunning) return;

    const command = this.options.command || 'claude';
    const args = this.options.args || [];

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Starting ${command} ${args.join(' ')}\n`);
    }

    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }  // Preserve colors
    });

    this.isRunning = true;
    
    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Claude process started with PID ${this.process.pid}\n`);
    }

    // Handle stdout
    this.process.stdout?.on('data', (data) => {
      this.emit('output', data);
      // Also write to stdout so user can see it
      process.stdout.write(data);
    });

    // Handle stderr
    this.process.stderr?.on('data', (data) => {
      this.emit('error-output', data);
      process.stderr.write(data);
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      this.isRunning = false;
      this.emit('exit', code);
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Process exited with code ${code}\n`);
      }
    });

    // Handle errors
    this.process.on('error', (err) => {
      this.isRunning = false;
      this.emit('error', err);
      if (this.options.verbose) {
        process.stderr.write(`[claudecom] Process error: ${err.message}\n`);
      }
    });
  }

  sendInput(input: string): void {
    if (!this.process || !this.isRunning) {
      if (this.options.verbose) {
        process.stderr.write('[claudecom] Cannot send input - process not running\n');
      }
      return;
    }

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Sending input to Claude: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}\n`);
    }

    // Send input to the process
    const written = this.process.stdin?.write(input + '\n');
    
    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Input sent successfully: ${written}\n`);
    }
  }

  stop(): void {
    if (!this.process || !this.isRunning) return;

    this.process.kill('SIGTERM');
    this.isRunning = false;
  }
}