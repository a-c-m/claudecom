import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeCommandOptions {
  command?: string;
  outputFormat?: 'text' | 'json' | 'stream-json';
  verbose?: boolean;
}

export class ClaudeCommand extends EventEmitter {
  constructor(private options: ClaudeCommandOptions = {}) {
    super();
  }

  async execute(prompt: string): Promise<void> {
    const command = this.options.command || 'claude';
    const args = ['-p', prompt];

    // Add output format if specified
    if (this.options.outputFormat && this.options.outputFormat !== 'text') {
      args.push('--output-format', this.options.outputFormat);
    }

    if (this.options.verbose) {
      process.stderr.write(`[claudecom] Executing: ${command} ${args.join(' ')}\n`);
    }

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    // Collect output
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data); // Pass through to terminal
      this.emit('output', data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data); // Pass through to terminal
      this.emit('error-output', data);
    });

    return new Promise((resolve, reject) => {
      proc.on('exit', (code) => {
        if (code === 0) {
          this.emit('complete', stdout);
          resolve();
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}