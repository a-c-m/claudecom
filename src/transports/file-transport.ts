import { CommunicationTransport } from './types';
import { watch, existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { EventEmitter } from 'events';

export interface FileTransportConfig {
  inputPath?: string;
  outputPath?: string;
  watchInterval?: number;
}

export class FileTransport extends EventEmitter implements CommunicationTransport {
  public inputPath: string;  // Made public for display
  public outputPath: string; // Made public for display
  private watcher?: any;
  private messageHandler?: (context: string, message: string) => void;
  private contextId?: string;

  constructor(private config: FileTransportConfig = {}) {
    super();
    this.inputPath = config.inputPath || join(process.cwd(), 'input.txt');
    this.outputPath = config.outputPath || join(process.cwd(), 'output.txt');
  }

  async init(): Promise<void> {
    // Ensure directories exist
    mkdirSync(dirname(this.inputPath), { recursive: true });
    mkdirSync(dirname(this.outputPath), { recursive: true });

    // Create input file if it doesn't exist
    if (!existsSync(this.inputPath)) {
      writeFileSync(this.inputPath, '# Add your command/prompt here\n# The entire file content will be sent as one request\n');
    }

    // Clear or create output file
    writeFileSync(this.outputPath, `# ClaudeCom Output - ${new Date().toISOString()}\n\n`);
  }

  async setup(instanceName: string): Promise<{ contextId: string; displayName: string }> {
    this.contextId = `file-${instanceName}`;
    
    // Clear the input file on setup (except for comments)
    writeFileSync(this.inputPath, '# Add your command/prompt here\n# The entire file content will be sent as one request\n');
    
    // Start watching the input file
    this.startWatching();

    return {
      contextId: this.contextId,
      displayName: `File Transport (${this.inputPath} → ${this.outputPath})`
    };
  }

  private startWatching(): void {
    let isProcessing = false;
    
    // Initial check for any existing content
    setTimeout(() => {
      this.checkForNewCommands();
    }, 500);
    
    // Watch for changes to the input file
    this.watcher = watch(this.inputPath, { persistent: true }, async (eventType) => {
      if (eventType === 'change' && !isProcessing) {
        isProcessing = true;
        // Small delay to ensure file write is complete
        setTimeout(() => {
          this.checkForNewCommands();
          isProcessing = false;
        }, 200);
      }
    });

    // Also check periodically in case watch misses something
    const checkInterval = setInterval(() => {
      if (!isProcessing) {
        this.checkForNewCommands();
      }
    }, this.config.watchInterval || 5000); // Increased to 5 seconds
    
    // Store interval for cleanup
    (this as any).checkInterval = checkInterval;
  }

  private checkForNewCommands(): void {
    if (!existsSync(this.inputPath)) return;

    try {
      const content = readFileSync(this.inputPath, 'utf-8').trim();
      
      // Skip if file only contains comments or is empty
      const lines = content.split('\n');
      const nonCommentContent = lines
        .filter(line => !line.trim().startsWith('#') && line.trim().length > 0)
        .join('\n')
        .trim();
      
      if (nonCommentContent.length > 0) {
        // Send the entire content as one command
        if (this.messageHandler && this.contextId) {
          this.messageHandler(this.contextId, nonCommentContent);
        }
        
        // Clear the file after processing (keep the comment)
        writeFileSync(this.inputPath, '# Add your command/prompt here\n# The entire file content will be sent as one request\n');
      }
    } catch (error) {
      console.error('[FileTransport] Error reading input file:', error);
    }
  }

  async sendMessage(_context: string, message: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const formattedMessage = `[${timestamp}]\n${message}\n\n`;
      
      // Append to output file
      appendFileSync(this.outputPath, formattedMessage);
    } catch (error) {
      console.error('[FileTransport] Error writing to output file:', error);
    }
  }

  onMessage(handler: (context: string, message: string) => void): void {
    this.messageHandler = handler;
  }

  async cleanup(): Promise<void> {
    if (this.watcher) {
      this.watcher.close();
    }
    
    // Clear interval if exists
    if ((this as any).checkInterval) {
      clearInterval((this as any).checkInterval);
    }
    
    // Add cleanup message
    try {
      appendFileSync(this.outputPath, `\n# Session ended - ${new Date().toISOString()}\n`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  getInitTips(): string[] {
    // Return shorter paths if they're in the current directory
    const cwd = process.cwd();
    const inputDisplay = this.inputPath.startsWith(cwd) 
      ? this.inputPath.slice(cwd.length + 1) // +1 to remove the leading slash
      : this.inputPath;
    const outputDisplay = this.outputPath.startsWith(cwd)
      ? this.outputPath.slice(cwd.length + 1) // +1 to remove the leading slash
      : this.outputPath;
      
    return [
      `Input:  ${inputDisplay}`,
      `Output: ${outputDisplay}`
    ];
  }
}