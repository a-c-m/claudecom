import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ClaudeComConfig {
  transport?: string;
  instance?: string;
  verbose?: boolean;
  command?: string;
  // Transport-specific configurations
  file?: {
    inputPath?: string;
    outputPath?: string;
    watchInterval?: number;
  };
  slack?: {
    token?: string;
    appToken?: string;
    signingSecret?: string;
  };
  discord?: {
    token?: string;
    channelId?: string;
  };
  telegram?: {
    token?: string;
    chatId?: string;
  };
}

export class ConfigManager {
  private config: ClaudeComConfig = {};
  
  // Default configuration - minimal defaults only
  private defaults: ClaudeComConfig = {
    transport: 'file', // Default to file transport
    instance: process.cwd().split('/').pop() || 'claude-com',
    verbose: false,
    command: 'claude',
    file: {
      inputPath: './input.txt',
      outputPath: './output.txt'
    }
  };
  
  private configFound = false;
  
  constructor(private options: any = {}) {
    this.loadConfig();
  }
  
  getConfig(): ClaudeComConfig {
    return this.config;
  }
  
  private loadConfig(): void {
    // Priority order (highest to lowest):
    // 1. Command line options
    // 2. Environment variables
    // 3. Local config file (.claudecom.json)
    // 4. User config file (~/.claudecom.json)
    // 5. System config file (/etc/claudecom.json)
    // 6. Default values
    
    // Start with defaults
    this.config = this.deepMerge({}, this.defaults);
    
    // Load system config
    this.loadJsonConfig('/etc/claudecom/config.json');
    
    // Load user config (check multiple locations)
    this.loadJsonConfig(join(homedir(), '.config', 'claudecom', 'config.json'));
    this.loadJsonConfig(join(homedir(), '.claudecom', 'config.json'));
    
    // Load local config (check multiple names)
    this.loadJsonConfig('claudecom.json');
    this.loadJsonConfig('.claudecom.json');
    this.loadJsonConfig('.claudecom');
    
    // Load from specified config file
    if (this.options.config) {
      this.loadJsonConfig(this.options.config);
    }
    
    // Apply environment variables
    this.loadEnvConfig();
    
    // Apply command line options (highest priority)
    this.applyCommandLineOptions();
  }
  
  private loadJsonConfig(path: string): void {
    if (existsSync(path)) {
      try {
        const fileConfig = JSON.parse(readFileSync(path, 'utf-8'));
        this.config = this.deepMerge(this.config, fileConfig);
        this.configFound = true;
      } catch (error) {
        console.error(`Error loading config from ${path}:`, error);
      }
    }
  }
  
  private loadEnvConfig(): void {
    // General options
    if (process.env.CLAUDECOM_TRANSPORT) {
      this.config.transport = process.env.CLAUDECOM_TRANSPORT;
    }
    if (process.env.CLAUDECOM_INSTANCE) {
      this.config.instance = process.env.CLAUDECOM_INSTANCE;
    }
    if (process.env.CLAUDECOM_VERBOSE) {
      this.config.verbose = process.env.CLAUDECOM_VERBOSE === 'true';
    }
    
    // File transport
    if (process.env.CLAUDECOM_FILE_INPUT) {
      this.config.file = this.config.file || {};
      this.config.file.inputPath = process.env.CLAUDECOM_FILE_INPUT;
    }
    if (process.env.CLAUDECOM_FILE_OUTPUT) {
      this.config.file = this.config.file || {};
      this.config.file.outputPath = process.env.CLAUDECOM_FILE_OUTPUT;
    }
    
    // Slack transport
    if (process.env.SLACK_BOT_TOKEN) {
      this.config.slack = this.config.slack || {};
      this.config.slack.token = process.env.SLACK_BOT_TOKEN;
    }
    if (process.env.SLACK_APP_TOKEN) {
      this.config.slack = this.config.slack || {};
      this.config.slack.appToken = process.env.SLACK_APP_TOKEN;
    }
    if (process.env.SLACK_SIGNING_SECRET) {
      this.config.slack = this.config.slack || {};
      this.config.slack.signingSecret = process.env.SLACK_SIGNING_SECRET;
    }
  }
  
  private applyCommandLineOptions(): void {
    if (this.options.transport) {
      this.config.transport = this.options.transport;
    }
    if (this.options.name) {
      this.config.instance = this.options.name;
    }
    if (this.options.verbose !== undefined) {
      this.config.verbose = this.options.verbose;
    }
  }
  
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }
  
  get<T = any>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let result: any = this.config;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return defaultValue as T;
      }
    }
    
    return result as T;
  }
  
  getTransportConfig(transport: string): any {
    return this.config[transport as keyof ClaudeComConfig] || {};
  }
  
  isValid(): boolean {
    // Check if we have minimum required configuration
    return !!(this.config.transport || this.options.transport || this.options.adapter);
  }
  
  hasConfigFile(): boolean {
    return this.configFound;
  }
  
  getConfigSources(): string[] {
    const sources = [];
    if (this.configFound) sources.push('config file');
    if (Object.keys(this.options).length > 0) sources.push('command line');
    if (process.env.CLAUDECOM_TRANSPORT) sources.push('environment');
    return sources;
  }
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}