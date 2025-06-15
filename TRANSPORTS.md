# ClaudeCom Transports

ClaudeCom uses a transport layer to enable communication between Claude and external systems. This document describes the available transports and how to create custom ones.

## Built-in Transports

### File Transport (Default)

The file transport uses local files for bidirectional communication.

**Configuration:**
```json
{
  "transport": "file",
  "file": {
    "inputPath": "./input.txt",
    "outputPath": "./output.txt",
    "watchInterval": 5000
  }
}
```

**Usage:**
1. Write your message/command to `input.txt`
2. ClaudeCom sends it to Claude
3. Claude's response appears in `output.txt`
4. The input file is cleared after processing

**Implementation:** See [`src/transports/file-transport.ts`](src/transports/file-transport.ts)

### Slack Transport

Connect Claude to Slack using Socket Mode for real-time communication.

**Configuration:**
```json
{
  "transport": "slack",
  "slack": {
    "token": "xoxb-your-bot-token",
    "appToken": "xapp-your-app-token",
    "signingSecret": "your-signing-secret"
  }
}
```

**Setup:**
1. Create a Slack app at api.slack.com
2. Enable Socket Mode
3. Add bot token scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
4. Install the app to your workspace
5. Copy the tokens to your config

**Implementation:** See [`src/transports/slack-transport.ts`](src/transports/slack-transport.ts)

## Creating Custom Transports

You can create custom transports by implementing the `CommunicationTransport` interface.

### Transport Interface

```typescript
export interface CommunicationTransport {
  // Initialize the transport
  init(config?: TransportConfig): Promise<void>;
  
  // Set up for a specific instance
  setup(instanceName: string): Promise<SetupResult>;
  
  // Send a message from Claude
  sendMessage(context: string, message: string): Promise<void>;
  
  // Register handler for incoming messages to Claude
  onMessage(handler: (context: string, message: string) => void): void;
  
  // Clean up resources
  cleanup(): Promise<void>;
  
  // Optional: Provide usage tips
  getInitTips?(): string[];
}
```

### Example: Discord Transport

```typescript
import { CommunicationTransport } from './types';
import { Client, TextChannel } from 'discord.js';

export class DiscordTransport implements CommunicationTransport {
  private client: Client;
  private channel?: TextChannel;
  private messageHandler?: (context: string, message: string) => void;

  constructor(private config: { token: string; channelId: string }) {
    this.client = new Client({ intents: ['Guilds', 'GuildMessages', 'MessageContent'] });
  }

  async init(): Promise<void> {
    await this.client.login(this.config.token);
  }

  async setup(instanceName: string): Promise<SetupResult> {
    this.channel = await this.client.channels.fetch(this.config.channelId) as TextChannel;
    
    this.client.on('messageCreate', (message) => {
      if (message.author.bot) return;
      if (message.channel.id === this.config.channelId) {
        this.messageHandler?.('discord', message.content);
      }
    });

    return {
      contextId: `discord-${instanceName}`,
      displayName: `Discord Channel: ${this.channel.name}`
    };
  }

  async sendMessage(context: string, message: string): Promise<void> {
    await this.channel?.send(message);
  }

  onMessage(handler: (context: string, message: string) => void): void {
    this.messageHandler = handler;
  }

  async cleanup(): Promise<void> {
    this.client.destroy();
  }

  getInitTips(): string[] {
    return [`Channel: #${this.channel?.name || 'unknown'}`];
  }
}
```

### Using Custom Transports

1. **Create your transport file** (e.g., `my-transport.js`)
2. **Export your transport class** as default or named export
3. **Use it with ClaudeCom:**

```bash
# Via command line
claudecom --transport ./my-transport.js

# Via config file
{
  "transport": "./my-transport.js",
  "myTransport": {
    "apiKey": "your-key",
    "endpoint": "https://api.example.com"
  }
}
```

## Transport Development Tips

1. **Error Handling**: Always handle errors gracefully in your transport
2. **Cleanup**: Implement proper cleanup to avoid resource leaks
3. **Context**: Use the context parameter to handle multiple instances
4. **Buffering**: Consider buffering messages if your transport has rate limits
5. **Reconnection**: Implement reconnection logic for network-based transports

## Testing Your Transport

```bash
# Test with verbose logging
claudecom --transport ./my-transport.js --verbose

# Test with a specific config
claudecom --transport ./my-transport.js --config test-config.json
```

## Contributing

To contribute a new transport:
1. Create your transport in `src/transports/`
2. Add it to the switch statement in `src/transports/index.ts`
3. Document it in this file
4. Submit a pull request

For questions or issues, please open an issue on GitHub.