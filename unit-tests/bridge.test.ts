import { PassThrough, Readable, Writable } from 'stream';
import { TerminalBridge } from '../src/bridge';
import { CommunicationAdapter } from '../src/adapters/types';

// Mock adapter for testing
class MockAdapter implements CommunicationAdapter {
  messages: Array<{ context: string; message: string }> = [];
  messageHandler?: (context: string, message: string) => void;
  
  async init(): Promise<void> {
    // Mock implementation
  }
  
  async setup(instanceName: string): Promise<{ contextId: string; displayName: string }> {
    return {
      contextId: `mock-${instanceName}`,
      displayName: `Mock ${instanceName}`
    };
  }
  
  async sendMessage(context: string, message: string): Promise<void> {
    this.messages.push({ context, message });
  }
  
  onMessage(handler: (context: string, message: string) => void): void {
    this.messageHandler = handler;
  }
  
  async cleanup(): Promise<void> {
    this.messages = [];
  }
  
  // Helper method for testing
  simulateMessage(context: string, message: string): void {
    if (this.messageHandler) {
      this.messageHandler(context, message);
    }
  }
}

describe('TerminalBridge', () => {
  let bridge: TerminalBridge;
  let mockStdin: PassThrough;
  let mockStdout: PassThrough;
  let mockAdapter: MockAdapter;
  let stdoutData: string;

  beforeEach(() => {
    mockStdin = new PassThrough();
    mockStdout = new PassThrough();
    mockAdapter = new MockAdapter();
    stdoutData = '';
    
    mockStdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });
  });

  afterEach(async () => {
    if (bridge) {
      await bridge.stop();
    }
  });

  it('should pass through data from stdin to stdout', async () => {
    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: mockAdapter,
      instanceName: 'test-instance',
      verbose: false
    });

    await bridge.start();

    mockStdin.write('Hello, World!\n');
    mockStdin.end();

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    expect(stdoutData).toBe('Hello, World!\n');
  });

  it('should send terminal output to adapter', async () => {
    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: mockAdapter,
      instanceName: 'test-instance',
      verbose: false
    });

    await bridge.start();

    mockStdin.write('Line 1\n');
    mockStdin.write('Line 2\n');
    
    // Allow time for buffering
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(mockAdapter.messages.length).toBeGreaterThan(0);
    const lastMessage = mockAdapter.messages[mockAdapter.messages.length - 1];
    expect(lastMessage.message).toContain('Line 1\\nLine 2\\n');
  });

  it('should batch messages within buffer timeout', async () => {
    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: mockAdapter,
      instanceName: 'test-instance',
      verbose: false,
      bufferTimeout: 100 // Short timeout for testing
    });

    await bridge.start();

    // Send multiple lines quickly
    mockStdin.write('Line 1\n');
    mockStdin.write('Line 2\n');
    mockStdin.write('Line 3\n');
    
    // Wait for buffer timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should batch into one message
    expect(mockAdapter.messages.length).toBe(2); // Start message + batched output
    const outputMessage = mockAdapter.messages.find(m => m.message.includes('Line 1'));
    expect(outputMessage?.message).toContain('Line 1\\nLine 2\\nLine 3\\n');
  });

  it('should handle adapter initialization errors gracefully', async () => {
    const errorAdapter = new MockAdapter();
    errorAdapter.init = async () => {
      throw new Error('Adapter init failed');
    };

    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: errorAdapter,
      instanceName: 'test-instance',
      verbose: false
    });

    await bridge.start();

    // Should still pass through data even if adapter fails
    mockStdin.write('Test data\n');
    mockStdin.end();

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    expect(stdoutData).toBe('Test data\n');
  });

  it('should send status messages', async () => {
    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: mockAdapter,
      instanceName: 'test-instance',
      verbose: false
    });

    await bridge.start();
    
    // Check for start message
    expect(mockAdapter.messages.length).toBe(1);
    expect(mockAdapter.messages[0].message).toContain('🟢 Instance started: test-instance');
    
    await bridge.stop();
    
    // Check for stop message
    expect(mockAdapter.messages[mockAdapter.messages.length - 1].message).toContain('🔴 Instance terminated');
  });

  it('should handle command injection from adapter', async () => {
    bridge = new TerminalBridge({
      stdin: mockStdin,
      stdout: mockStdout,
      adapter: mockAdapter,
      instanceName: 'test-instance',
      verbose: false
    });

    await bridge.start();

    // Simulate command from adapter
    mockAdapter.simulateMessage('mock-test-instance', 'echo "Hello from chat"');

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should echo command to stdout with prefix
    expect(stdoutData).toContain('[MOCK] echo "Hello from chat"');
  });
});