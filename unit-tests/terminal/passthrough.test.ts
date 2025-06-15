import { PassThrough, Readable, Writable } from 'stream';
import { Passthrough } from '../../src/terminal/passthrough';

describe('Passthrough', () => {
  let passthrough: Passthrough;
  let mockStdin: Readable;
  let mockStdout: Writable;
  let stdoutData: string;
  let stdoutBuffer: Buffer[];

  beforeEach(() => {
    mockStdin = new PassThrough();
    stdoutBuffer = [];
    mockStdout = new Writable({
      write(chunk: any, _encoding: any, callback: any) {
        stdoutData += chunk.toString();
        stdoutBuffer.push(Buffer.from(chunk));
        callback();
      }
    });
    stdoutData = '';
  });

  afterEach(() => {
    if (passthrough) {
      passthrough.destroy();
    }
  });

  it('should pass data from stdin to stdout without modification', async () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const testData = 'Hello, World!\nThis is a test.\n';
    mockStdin.push(testData);
    mockStdin.push(null); // End stream

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    expect(stdoutData).toBe(testData);
  });

  it('should handle binary data correctly', async () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
    mockStdin.push(binaryData);
    mockStdin.push(null);

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    const result = Buffer.concat(stdoutBuffer);
    expect(result).toEqual(binaryData);
  });

  it('should emit data events for monitoring', async () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const receivedData: string[] = [];
    passthrough.on('data', (chunk: Buffer) => {
      receivedData.push(chunk.toString());
    });

    mockStdin.push('Line 1\n');
    mockStdin.push('Line 2\n');
    mockStdin.push(null);

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    expect(receivedData).toEqual(['Line 1\n', 'Line 2\n']);
  });

  it('should handle ANSI escape codes', async () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const ansiData = '\x1b[31mRed Text\x1b[0m\n';
    mockStdin.push(ansiData);
    mockStdin.push(null);

    await new Promise(resolve => mockStdout.on('finish', resolve));
    
    expect(stdoutData).toBe(ansiData);
  });

  it('should handle stream errors gracefully', async () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const errorHandler = jest.fn();
    passthrough.on('error', errorHandler);

    const testError = new Error('Test stream error');
    mockStdin.emit('error', testError);

    expect(errorHandler).toHaveBeenCalledWith(testError);
  });

  it('should clean up resources on destroy', () => {
    passthrough = new Passthrough(mockStdin, mockStdout);
    
    const destroySpy = jest.spyOn(passthrough, 'destroy');
    passthrough.destroy();
    
    expect(destroySpy).toHaveBeenCalled();
  });
});