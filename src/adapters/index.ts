import { CommunicationAdapter } from './types';
import { FileAdapter } from './file';
import { resolve } from 'path';
import { existsSync } from 'fs';

export type AdapterType = 'file' | 'slack' | 'discord' | 'telegram' | string;

export function createAdapter(type: AdapterType, config?: any): CommunicationAdapter {
  // Check if type is a file path
  if (type.endsWith('.js') || type.endsWith('.ts')) {
    const adapterPath = resolve(type);
    
    if (!existsSync(adapterPath)) {
      throw new Error(`Custom adapter file not found: ${adapterPath}`);
    }
    
    try {
      // Dynamic import for custom adapters
      const AdapterModule = require(adapterPath);
      const AdapterClass = AdapterModule.default || AdapterModule;
      
      if (typeof AdapterClass !== 'function') {
        throw new Error(`Custom adapter must export a class: ${adapterPath}`);
      }
      
      return new AdapterClass(config);
    } catch (error: any) {
      throw new Error(`Failed to load custom adapter: ${error.message}`);
    }
  }
  
  // Built-in adapters
  switch (type) {
    case 'file':
      return new FileAdapter(config);
    case 'slack':
      throw new Error('Slack adapter not implemented yet');
    case 'discord':
      throw new Error('Discord adapter not implemented yet');
    case 'telegram':
      throw new Error('Telegram adapter not implemented yet');
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

export { CommunicationAdapter } from './types';