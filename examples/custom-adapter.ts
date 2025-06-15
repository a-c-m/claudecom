import { CommunicationAdapter } from '../src/adapters/types';
import { EventEmitter } from 'events';

/**
 * Example custom adapter implementation
 * 
 * This adapter logs all messages to console with timestamps
 * and could be extended to send to any custom service
 */
export default class CustomAdapter extends EventEmitter implements CommunicationAdapter {
  private messageHandler?: (context: string, message: string) => void;
  
  constructor(private config: any = {}) {
    super();
    console.log('[CustomAdapter] Initialized with config:', config);
  }
  
  async init(): Promise<void> {
    console.log('[CustomAdapter] Initializing...');
    // Custom initialization logic here
  }
  
  async setup(instanceName: string): Promise<{ contextId: string; displayName: string }> {
    const contextId = `custom-${instanceName}-${Date.now()}`;
    console.log(`[CustomAdapter] Setting up instance: ${instanceName}`);
    
    return {
      contextId,
      displayName: `Custom Adapter: ${instanceName}`
    };
  }
  
  async sendMessage(context: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[CustomAdapter] [${timestamp}] [${context}] ${message}`);
    
    // You could send to any service here:
    // - HTTP webhook
    // - Database
    // - Message queue
    // - Email
    // - etc.
  }
  
  onMessage(handler: (context: string, message: string) => void): void {
    this.messageHandler = handler;
    
    // Example: simulate receiving a message after 5 seconds
    setTimeout(() => {
      if (this.messageHandler) {
        this.messageHandler('custom-context', 'Hello from custom adapter!');
      }
    }, 5000);
  }
  
  async cleanup(): Promise<void> {
    console.log('[CustomAdapter] Cleaning up...');
    // Custom cleanup logic here
  }
}