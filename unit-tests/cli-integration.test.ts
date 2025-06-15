import { spawn } from 'child_process';
import { join } from 'path';

describe('ClaudeCom CLI Integration', () => {
  const cliPath = join(__dirname, '../src/index.ts');

  it('should show help with --help flag', (done) => {
    const proc = spawn('npx', ['tsx', cliPath, '--help'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      expect(code).toBe(0);
      expect(stdout).toContain('Bridge terminal apps to chat platforms');
      expect(stdout).toContain('Usage:');
      done();
    });
  });

  it('should pass through piped data', (done) => {
    const echo = spawn('echo', ['Hello from pipe']);
    const claudecom = spawn('npx', ['tsx', cliPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    echo.stdout.pipe(claudecom.stdin);

    let output = '';
    claudecom.stdout.on('data', (data) => {
      output += data.toString();
    });

    claudecom.on('close', () => {
      expect(output.trim()).toBe('Hello from pipe');
      done();
    });
  });

  it('should show verbose output when --verbose flag is used', (done) => {
    const echo = spawn('echo', ['Test data']);
    const claudecom = spawn('npx', ['tsx', cliPath, '--verbose'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    echo.stdout.pipe(claudecom.stdin);

    let stderr = '';
    claudecom.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claudecom.on('close', () => {
      expect(stderr).toContain('[claudecom] Starting with instance name:');
      expect(stderr).toContain('[claudecom] Using adapter: slack');
      expect(stderr).toContain('[claudecom] Received');
      expect(stderr).toContain('bytes');
      done();
    });
  });

  it('should handle piped data continuously', (done) => {
    const claudecom = spawn('npx', ['tsx', cliPath, '--verbose'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let stderr = '';
    
    claudecom.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    claudecom.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send data in chunks
    claudecom.stdin.write('Line 1\n');
    claudecom.stdin.write('Line 2\n');
    claudecom.stdin.end('Line 3\n');

    claudecom.on('close', () => {
      expect(output).toBe('Line 1\nLine 2\nLine 3\n');
      expect(stderr).toContain('[claudecom] Received');
      done();
    });
  });
});