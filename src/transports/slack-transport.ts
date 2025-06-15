import { CommunicationTransport, TransportConfig } from './types';
import { App, SocketModeReceiver } from '@slack/bolt';
import { EventEmitter } from 'events';

export interface SlackTransportConfig extends TransportConfig {
  token?: string;
  appToken?: string;
  signingSecret?: string;
  defaultChannel?: string;
}

export class SlackTransport extends EventEmitter implements CommunicationTransport {
  private app?: App;
  private messageHandler?: (context: string, message: string) => void;
  private contextId?: string;
  private processedMessages = new Set<string>();
  private channelId?: string;

  constructor(private config: SlackTransportConfig = {}) {
    super();
    
    // Validate required config
    if (!config.token) {
      throw new Error('Slack bot token (token) is required');
    }
    if (!config.appToken) {
      throw new Error('Slack app token (appToken) is required');
    }
    if (!config.signingSecret) {
      throw new Error('Slack signing secret (signingSecret) is required');
    }
  }

  async init(): Promise<void> {
    // Initialize Slack app with Socket Mode
    const socketModeReceiver = new SocketModeReceiver({
      appToken: this.config.appToken!,
      clientId: 'claudecom', // Not used in socket mode but required
      clientSecret: 'claudecom', // Not used in socket mode but required
    });

    this.app = new App({
      token: this.config.token,
      signingSecret: this.config.signingSecret!,
      receiver: socketModeReceiver,
      // Disable request verification for Socket Mode
      processBeforeResponse: true,
    });

    // Start the app
    await this.app.start();
  }

  async setup(instanceName: string): Promise<{ contextId: string; displayName: string }> {
    this.contextId = `slack-${instanceName}`;

    if (!this.app) {
      throw new Error('Slack app not initialized');
    }

    // Set up message handler
    this.app.message(async ({ message, say }) => {
      // Only process messages from users (not bots)
      if ('bot_id' in message) return;
      
      // Get the message details
      const messageId = `${message.channel}-${message.ts}`;
      
      // Skip if we've already processed this message
      if (this.processedMessages.has(messageId)) return;
      this.processedMessages.add(messageId);
      
      // Clean up old message IDs (keep last 100)
      if (this.processedMessages.size > 100) {
        const oldestIds = Array.from(this.processedMessages).slice(0, -100);
        oldestIds.forEach(id => this.processedMessages.delete(id));
      }

      // Store channel for responses
      if (!this.channelId && message.channel) {
        this.channelId = message.channel;
      }

      // Extract text content
      const text = 'text' in message ? message.text : '';
      if (!text) return;

      // Check for STOP command
      if (text.trim().toUpperCase() === 'STOP') {
        await say('🛑 Sending STOP command to Claude...');
      }

      // Forward to Claude
      if (this.messageHandler) {
        this.messageHandler(this.contextId!, text);
      }
    });

    // Get default channel name if specified
    let channelName = 'DM the bot';
    if (this.config.defaultChannel) {
      try {
        const channelInfo = await this.app.client.conversations.info({
          token: this.config.token,
          channel: this.config.defaultChannel,
        });
        if (channelInfo.channel && 'name' in channelInfo.channel) {
          channelName = `#${channelInfo.channel.name}`;
          this.channelId = this.config.defaultChannel;
        }
      } catch (error) {
        // Ignore errors, use default
      }
    }

    return {
      contextId: this.contextId,
      displayName: `Slack (${channelName})`,
    };
  }

  async sendMessage(_context: string, message: string): Promise<void> {
    if (!this.app || !this.channelId) return;

    try {
      // Split long messages (Slack has a 3000 character limit for text)
      const chunks = this.splitMessage(message, 2900);
      
      for (const chunk of chunks) {
        await this.app.client.chat.postMessage({
          token: this.config.token,
          channel: this.channelId,
          text: chunk,
          // Disable link previews for cleaner output
          unfurl_links: false,
          unfurl_media: false,
        });
        
        // Small delay between chunks to maintain order
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('[SlackTransport] Error sending message:', error);
    }
  }

  onMessage(handler: (context: string, message: string) => void): void {
    this.messageHandler = handler;
  }

  async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.stop();
    }
  }

  getInitTips(): string[] {
    const tips = ['Send messages to the bot to communicate with Claude'];
    if (this.config.defaultChannel) {
      tips.push(`Default channel: ${this.config.defaultChannel}`);
    }
    tips.push('Send "STOP" to cancel Claude\'s current operation');
    return tips;
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    let remaining = message;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a newline
      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      
      // If no newline, try to split at a space
      if (splitIndex === -1) {
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }
      
      // If still no good split point, just split at maxLength
      if (splitIndex === -1) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }
}