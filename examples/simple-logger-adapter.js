const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Simple logger adapter that writes to a log file
 */
class SimpleLoggerAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logFile = config.logFile || 'claudecom.log';
    this.messageHandler = null;
  }
  
  async init() {
    // Ensure log directory exists
    const dir = path.dirname(this.logFile);
    if (dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Clear or create log file
    fs.writeFileSync(this.logFile, `=== ClaudeCom Session Started ${new Date().toISOString()} ===\n\n`);
  }
  
  async setup(instanceName) {
    this.instanceName = instanceName;
    this.contextId = `logger-${instanceName}`;
    
    this.log(`Instance setup: ${instanceName}`);
    
    return {
      contextId: this.contextId,
      displayName: `Logger: ${instanceName}`
    };
  }
  
  async sendMessage(context, message) {
    this.log(`[${context}] ${message}`);
  }
  
  onMessage(handler) {
    this.messageHandler = handler;
  }
  
  async cleanup() {
    this.log(`=== Session Ended ${new Date().toISOString()} ===\n`);
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Write to log file
    fs.appendFileSync(this.logFile, logEntry);
    
    // Also print to console if verbose
    if (this.config?.verbose) {
      console.log(logEntry.trim());
    }
  }
}

module.exports = SimpleLoggerAdapter;