import { CommunicationAdapter } from './types';
import { FileAdapter } from './file';

export type AdapterType = 'file' | 'slack' | 'discord' | 'telegram';

export function createAdapter(type: AdapterType, config?: any): CommunicationAdapter {
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