import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';

describe('E2E File-based Testing', () => {
  const cliPath = join(__dirname, '../src/index.ts');
  const testDir = join(__dirname, '../.claude/wip/test-files');
  const inputFile = join(testDir, 'input.txt');
  const outputFile = join(testDir, 'output.txt');
  
  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    // Create test input file
    writeFileSync(inputFile, 'Line 1 from file\nLine 2 from file\nLine 3 from file\n');
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should pass file content through unchanged (non-invasive)', (done) => {
    // Use cat to pipe file through claudecom
    const catProcess = spawn('cat', [inputFile]);
    const claudecomProcess = spawn('npx', ['tsx', cliPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Capture output
    let output = '';
    claudecomProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Pipe cat output to claudecom
    catProcess.stdout.pipe(claudecomProcess.stdin);

    claudecomProcess.on('close', () => {
      // Write output to file for comparison
      writeFileSync(outputFile, output);
      
      // Compare input and output files
      const inputContent = readFileSync(inputFile, 'utf-8');
      const outputContent = readFileSync(outputFile, 'utf-8');
      
      expect(outputContent).toBe(inputContent);
      expect(outputContent).toBe('Line 1 from file\nLine 2 from file\nLine 3 from file\n');
      done();
    });
  });

  it('should handle binary file passthrough correctly', (done) => {
    // Create a binary test file
    const binaryFile = join(testDir, 'binary.dat');
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
    writeFileSync(binaryFile, binaryData);

    const catProcess = spawn('cat', [binaryFile]);
    const claudecomProcess = spawn('npx', ['tsx', cliPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const outputChunks: Buffer[] = [];
    claudecomProcess.stdout.on('data', (chunk) => {
      outputChunks.push(chunk);
    });

    catProcess.stdout.pipe(claudecomProcess.stdin);

    claudecomProcess.on('close', () => {
      const outputBuffer = Buffer.concat(outputChunks);
      const binaryOutputFile = join(testDir, 'binary-output.dat');
      writeFileSync(binaryOutputFile, outputBuffer);
      
      // Compare binary files
      const originalBinary = readFileSync(binaryFile);
      const outputBinary = readFileSync(binaryOutputFile);
      
      expect(outputBinary).toEqual(originalBinary);
      done();
    });
  });

  it('should preserve ANSI color codes in output', (done) => {
    // Create file with ANSI codes
    const ansiFile = join(testDir, 'ansi.txt');
    const ansiContent = '\x1b[31mRed Text\x1b[0m\n\x1b[32mGreen Text\x1b[0m\n';
    writeFileSync(ansiFile, ansiContent);

    const catProcess = spawn('cat', [ansiFile]);
    const claudecomProcess = spawn('npx', ['tsx', cliPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    claudecomProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    catProcess.stdout.pipe(claudecomProcess.stdin);

    claudecomProcess.on('close', () => {
      expect(output).toBe(ansiContent);
      expect(output).toContain('\x1b[31m');
      expect(output).toContain('\x1b[32m');
      done();
    });
  });

  it('should handle large file passthrough efficiently', (done) => {
    // Create a large file with repeated content
    const largeFile = join(testDir, 'large.txt');
    const lineCount = 1000;
    let content = '';
    for (let i = 0; i < lineCount; i++) {
      content += `Line ${i}: The quick brown fox jumps over the lazy dog.\n`;
    }
    writeFileSync(largeFile, content);

    const catProcess = spawn('cat', [largeFile]);
    const claudecomProcess = spawn('npx', ['tsx', cliPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    claudecomProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    catProcess.stdout.pipe(claudecomProcess.stdin);

    claudecomProcess.on('close', () => {
      // Verify all lines were passed through
      const outputLines = output.split('\n').filter(line => line.length > 0);
      expect(outputLines.length).toBe(lineCount);
      expect(output).toContain('Line 0:');
      expect(output).toContain('Line 999:');
      done();
    });
  });

  it('should verify verbose logging writes to stderr, not stdout', (done) => {
    const catProcess = spawn('cat', [inputFile]);
    const claudecomProcess = spawn('npx', ['tsx', cliPath, '--verbose'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    
    claudecomProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    claudecomProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    catProcess.stdout.pipe(claudecomProcess.stdin);

    claudecomProcess.on('close', () => {
      // stdout should only contain the original content
      expect(stdout).toBe('Line 1 from file\nLine 2 from file\nLine 3 from file\n');
      
      // stderr should contain verbose logging
      expect(stderr).toContain('[claudecom]');
      expect(stderr).toContain('Starting with instance name:');
      expect(stderr).toContain('Received');
      expect(stderr).toContain('bytes');
      
      done();
    });
  });

  // Test for future bidirectional communication via named pipes
  it.skip('should handle bidirectional communication via named pipes', (done) => {
    // This test is skipped for now as named pipes aren't implemented yet
    // It demonstrates how we'll test command injection
    
    // We'll implement this when we add named pipe support
    done();
  });
});