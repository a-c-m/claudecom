import { execSync } from 'child_process';
import { join } from 'path';

describe('ClaudeCom CLI', () => {
  const cliPath = join(__dirname, '../src/index.ts');
  
  const runCLI = (args: string = ''): string => {
    try {
      const output = execSync(`npx tsx ${cliPath} ${args}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      return output.trim();
    } catch (error: any) {
      return error.stdout?.trim() || error.message;
    }
  };

  describe('basic functionality', () => {
    it('should display version with --version flag', () => {
      const output = runCLI('--version');
      expect(output).toBe('1.0.0');
    });

    it('should display help with --help flag', () => {
      const output = runCLI('--help');
      expect(output).toContain('Bridge terminal apps to chat platforms');
      expect(output).toContain('-n, --name <name>');
      expect(output).toContain('-a, --adapter <type>');
      expect(output).toContain('--mcp-config <path>');
      expect(output).toContain('--config <path>');
      expect(output).toContain('--no-color');
      expect(output).toContain('--verbose');
    });

    it('should accept name option', () => {
      const output = runCLI('--name test-instance --help');
      expect(output).toContain('Bridge terminal apps to chat platforms');
    });

    it('should accept adapter option', () => {
      const output = runCLI('--adapter telegram --help');
      expect(output).toContain('Bridge terminal apps to chat platforms');
    });
  });

  describe('error handling', () => {
    it('should handle unknown options gracefully', () => {
      const output = runCLI('--unknown-option');
      expect(output).toContain("error: unknown option '--unknown-option'");
    });
  });
});