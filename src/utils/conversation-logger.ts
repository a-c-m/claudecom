import { stripAnsi } from './ansi-stripper';

export class ConversationLogger {
  private lastUserMessage = '';
  private lastLoggedUser = '';     // Track what we actually logged
  private lastLoggedClaude = '';   // Track what we actually logged
  private isCapturingResponse = false;
  private responseBuffer: string[] = [];
  private lastProcessTime = Date.now();
  
  process(rawText: string): string | null {
    // Strip ANSI codes first
    const text = stripAnsi(rawText);
    
    // Remove control characters (like Ctrl+U which appears as \x15)
    const cleanText = text.replace(/[\x00-\x1F\x7F]/g, (match) => {
      // Keep newlines and tabs
      if (match === '\n' || match === '\t') return match;
      return '';
    });
    
    // Split into lines and process
    const lines = cleanText.split('\n');
    const conversationParts: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and UI elements
      if (!trimmed || 
          trimmed.includes('─') || 
          trimmed.includes('╭') || 
          trimmed.includes('╰') || 
          trimmed.includes('│') ||
          trimmed.includes('? for shortcuts') ||
          trimmed.includes('Use /ide to connect') ||
          trimmed.includes('Tip:') ||
          trimmed.includes('Try "')) {
        continue;
      }
      
      // Detect user input (lines starting with >)
      if (trimmed.startsWith('>')) {
        // If we were capturing a response, save it first
        if (this.isCapturingResponse && this.responseBuffer.length > 0) {
          const response = this.responseBuffer.join('\n').trim();
          if (response) {
            conversationParts.push(`Claude: ${response}\n`);
          }
          this.responseBuffer = [];
          this.isCapturingResponse = false;
        }
        
        // Extract and save user message
        const newUserMessage = trimmed.substring(1).trim();
        if (newUserMessage) {
          this.lastUserMessage = newUserMessage;
          // Only log if we haven't logged this exact message before
          if (newUserMessage !== this.lastLoggedUser) {
            this.lastLoggedUser = newUserMessage;
            conversationParts.push(`User: ${this.lastUserMessage}\n`);
          }
        }
      }
      // Detect Claude's response (lines starting with ⏺)
      else if (trimmed.startsWith('⏺')) {
        this.isCapturingResponse = true;
        // Add the response text (without the ⏺ marker)
        const responseText = trimmed.substring(1).trim();
        if (responseText) {
          this.responseBuffer.push(responseText);
        }
      }
      // Continue capturing multi-line responses
      else if (this.isCapturingResponse) {
        // Skip status messages during response
        if (trimmed && 
            !trimmed.includes('Thriving') && 
            !trimmed.includes('tokens') &&
            !trimmed.includes('Done') &&
            !trimmed.includes('API Error') &&
            !trimmed.includes('Tool uses')) {
          this.responseBuffer.push(trimmed);
        }
      }
      // If we hit a new prompt or empty line after capturing, save the response
      else if ((trimmed === '' || trimmed.includes('│ >')) && this.isCapturingResponse && this.responseBuffer.length > 0) {
        const response = this.responseBuffer.join('\n').trim();
        if (response) {
          // Only log if we haven't logged this exact response before
          if (response !== this.lastLoggedClaude) {
            this.lastLoggedClaude = response;
            conversationParts.push(`Claude: ${response}\n`);
          }
        }
        this.responseBuffer = [];
        this.isCapturingResponse = false;
      }
    }
    
    // If we have conversation parts, return them
    if (conversationParts.length > 0) {
      return conversationParts.join('');
    }
    
    // If we have a completed response buffer, return it
    if (this.isCapturingResponse && this.responseBuffer.length > 0) {
      const response = this.responseBuffer.join('\n').trim();
      const timeSinceLastProcess = Date.now() - this.lastProcessTime;
      
      // Flush if we have content and either:
      // 1. It's been more than 200ms since last update (response is likely complete)
      // 2. The response doesn't include status messages
      if (response && !response.includes('Thriving') && 
          (timeSinceLastProcess > 200 || !rawText.includes('⏺'))) {
        // Only return if we haven't logged this before
        if (response !== this.lastLoggedClaude) {
          this.lastLoggedClaude = response;
          this.responseBuffer = [];
          this.isCapturingResponse = false;
          return `Claude: ${response}\n`;
        }
      }
    }
    
    this.lastProcessTime = Date.now();
    return null;
  }
}