import { CommunicationTransport } from './types';
import { FileTransport } from './file-transport';
import { SlackTransport } from './slack-transport';
import { resolve } from 'path';
import { existsSync } from 'fs';

export type TransportType = 'file' | 'slack' | 'discord' | 'telegram' | string;

export function createTransport(type: TransportType, config?: any): CommunicationTransport {
  // Check if type is a file path
  if (type.endsWith('.js') || type.endsWith('.ts')) {
    const adapterPath = resolve(type);
    
    if (!existsSync(adapterPath)) {
      throw new Error(`Custom transport file not found: ${adapterPath}`);
    }
    
    try {
      // Dynamic import for custom transports
      const TransportModule = require(adapterPath);
      const TransportClass = TransportModule.default || TransportModule;
      
      if (typeof TransportClass !== 'function') {
        throw new Error(`Custom transport must export a class: ${adapterPath}`);
      }
      
      return new TransportClass(config);
    } catch (error: any) {
      throw new Error(`Failed to load custom transport: ${error.message}`);
    }
  }
  
  // Built-in transports
  switch (type) {
    case 'file':
      return new FileTransport(config);
    case 'slack':
      return new SlackTransport(config);
    case 'discord':
      throw new Error('Discord transport not implemented yet');
    case 'telegram':
      throw new Error('Telegram transport not implemented yet');
    default:
      throw new Error(`Unknown transport type: ${type}`);
  }
}

export { CommunicationTransport } from './types';