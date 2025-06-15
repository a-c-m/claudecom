import { ConversationLogger } from './conversation-logger';

describe('ConversationLogger', () => {
  let logger: ConversationLogger;

  beforeEach(() => {
    logger = new ConversationLogger();
  });

  it('should strip ANSI codes', () => {
    const input = '\x1b[2K\x1b[1A> hello\n\x1b[38;2;255;255;255m⏺ response\x1b[0m';
    const result = logger.process(input);
    expect(result).toBe('User: hello\n\nClaude: response\n');
  });

  it('should filter out UI elements', () => {
    const input = `
╭────────────────╮
│ > test message │
╰────────────────╯
⏺ test response
✻ Thriving… (17s · ↓ 71 tokens)
? for shortcuts
`;
    const result = logger.process(input);
    expect(result).toBe('User: test message\n\nClaude: test response\n');
  });

  it('should handle multi-line responses', () => {
    const input = `
> multi-line question
⏺ This is a response
that spans multiple
lines of text
`;
    const result = logger.process(input);
    expect(result).toBe('User: multi-line question\n\nClaude: This is a response\nthat spans multiple\nlines of text\n');
  });

  it('should remove control characters like Ctrl+U', () => {
    const input = '> \x15tell me a fact\n⏺ Here is a fact';
    const result = logger.process(input);
    expect(result).toBe('User: tell me a fact\n\nClaude: Here is a fact\n');
  });

  it('should handle incomplete responses', () => {
    // First chunk
    let result = logger.process('> question\n⏺ Starting response...');
    expect(result).toBe('User: question\n');
    
    // Second chunk completes it
    result = logger.process('more text\n\n');
    expect(result).toBe('Claude: Starting response...\nmore text\n');
  });

  it('should ignore status messages in responses', () => {
    const input = `
⏺ Actual response text
✻ Thriving...
tokens used: 123
Done
API Error (ignored)
Tool uses: 2
more actual text
`;
    const result = logger.process(input);
    expect(result).toBe('Claude: Actual response text\nmore actual text\n');
  });
});