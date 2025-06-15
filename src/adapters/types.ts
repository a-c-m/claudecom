export interface AdapterConfig {
  [key: string]: any;
}

export interface SetupResult {
  contextId: string;
  displayName: string;
}

export interface CommunicationAdapter {
  init(config?: AdapterConfig): Promise<void>;
  setup(instanceName: string): Promise<SetupResult>;
  sendMessage(context: string, message: string): Promise<void>;
  onMessage(handler: (context: string, message: string) => void): void;
  cleanup(): Promise<void>;
}