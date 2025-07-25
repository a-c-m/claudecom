export interface TransportConfig {
  [key: string]: any;
}

export interface SetupResult {
  contextId: string;
  displayName: string;
}

export interface CommunicationTransport {
  init(config?: TransportConfig): Promise<void>;
  setup(instanceName: string): Promise<SetupResult>;
  sendMessage(context: string, message: string): Promise<void>;
  onMessage(handler: (context: string, message: string) => void): void;
  cleanup(): Promise<void>;
  
  // Optional method to provide transport-specific tips
  getInitTips?(): string[];
}