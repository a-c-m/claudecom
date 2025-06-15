import { stripAnsi } from './ansi-stripper';

export class ConversationLogger {
  private lastLoggedUser = '';     // Track what we actually logged
  private lastLoggedClaude = '';   // Track what we actually logged
  private isCapturingResponse = false;
  private isCapturingUserInput = false;  // Track multi-line user input
  private userInputBuffer: string[] = [];  // Buffer for multi-line user input
  private responseBuffer: string[] = [];
  private lastProcessTime = Date.now();
  private recentLines = new Set<string>();  // Track recent lines to avoid duplicates
  private lineTimestamps = new Map<string, number>();  // Track when lines were seen
  private isInPermissionDialog = false;  // Track when we're in a permission dialog
  
  process(rawText: string): string | null {
    // Strip ANSI codes first
    const text = stripAnsi(rawText);
    
    // Remove control characters (like Ctrl+U which appears as \x15)
    /* eslint-disable no-control-regex */
    const cleanText = text.replace(/[\x00-\x1F\x7F]/g, (match) => {
      // Keep newlines and tabs
      if (match === '\n' || match === '\t') return match;
      return '';
    });
    /* eslint-enable no-control-regex */
    
    // Clean up old entries from duplicate tracking (older than 5 seconds)
    const now = Date.now();
    for (const [line, timestamp] of this.lineTimestamps.entries()) {
      if (now - timestamp > 5000) {
        this.recentLines.delete(line);
        this.lineTimestamps.delete(line);
      }
    }
    
    // Split into lines and process
    const lines = cleanText.split('\n');
    const conversationParts: string[] = [];
    
    // Check if we're entering a permission dialog
    if (cleanText.includes('Claude needs your permission to use') || 
        cleanText.includes('Do you want to make this edit')) {
      this.isInPermissionDialog = true;
      
      // Extract tool name if possible
      const toolMatch = cleanText.match(/Claude needs your permission to use (\w+)/);
      const toolName = toolMatch ? toolMatch[1] : 'a tool';
      
      // Only log once per dialog
      const dialogMsg = `[Permission requested for ${toolName}]`;
      if (this.lastLoggedClaude !== dialogMsg) {
        this.lastLoggedClaude = dialogMsg;
        return `Claude: ${dialogMsg}\n`;
      }
      return null;
    }
    
    // If we're in a permission dialog, skip processing until it's resolved
    if (this.isInPermissionDialog) {
      // Check if dialog is resolved (user selected an option)
      if (cleanText.includes('Yes') || cleanText.includes('No, and tell Claude') ||
          cleanText.includes('│ >') || cleanText.includes('⏺')) {
        this.isInPermissionDialog = false;
      }
      return null;
    }
    
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
          trimmed.includes('Try "') ||
          trimmed.includes('Do you want to make this edit') ||
          trimmed.includes('Edit file') ||
          trimmed.includes('Yes, and don\'t ask again') ||
          trimmed.includes('No, and tell Claude')) {
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
        
        // Start capturing user input
        this.isCapturingUserInput = true;
        this.userInputBuffer = [];
        
        // Extract and save first line of user message
        const firstLine = trimmed.substring(1).trim();
        if (firstLine) {
          this.userInputBuffer.push(firstLine);
        }
      }
      // Continue capturing multi-line user input
      else if (this.isCapturingUserInput && !trimmed.startsWith('⏺')) {
        // If we hit an empty line or a new prompt, we're done with user input
        if (trimmed === '' || trimmed.includes('│ >')) {
          if (this.userInputBuffer.length > 0) {
            const fullUserMessage = this.userInputBuffer.join('\n').trim();
            // Only log if we haven't logged this exact message before
            if (fullUserMessage !== this.lastLoggedUser) {
              this.lastLoggedUser = fullUserMessage;
              conversationParts.push(`User: ${fullUserMessage}\n`);
            }
            this.userInputBuffer = [];
          }
          this.isCapturingUserInput = false;
        } else {
          // Add this line to the user input buffer
          this.userInputBuffer.push(trimmed);
        }
      }
      // Detect Claude's response (lines starting with ⏺)
      else if (trimmed.startsWith('⏺')) {
        // If we were still capturing user input, save it first
        if (this.isCapturingUserInput && this.userInputBuffer.length > 0) {
          const fullUserMessage = this.userInputBuffer.join('\n').trim();
          // Only log if we haven't logged this exact message before
          if (fullUserMessage !== this.lastLoggedUser) {
            this.lastLoggedUser = fullUserMessage;
            conversationParts.push(`User: ${fullUserMessage}\n`);
          }
          this.userInputBuffer = [];
          this.isCapturingUserInput = false;
        }
        
        this.isCapturingResponse = true;
        // Add the response text (without the ⏺ marker)
        const responseText = trimmed.substring(1).trim();
        if (responseText && !this.recentLines.has(responseText)) {
          this.responseBuffer.push(responseText);
          this.recentLines.add(responseText);
          this.lineTimestamps.set(responseText, Date.now());
        }
      }
      // Continue capturing multi-line responses
      else if (this.isCapturingResponse) {
        // Check if this is a progress indicator line
        const progressMatch = trimmed.match(/^[✻✽✶✳✢·]?\s*(\w+)…\s*\((\d+)s\s*·\s*([↑↓⚒])\s*(\d+)\s*tokens\s*·\s*esc to interrupt\)$/);
        
        if (progressMatch) {
          // This is a progress indicator - skip it entirely
          continue;
        }
        // Skip status messages during response
        else if (trimmed && 
            !trimmed.includes('Thriving') && 
            !trimmed.includes('tokens') &&
            !trimmed.includes('Done') &&
            !trimmed.includes('API Error') &&
            !trimmed.includes('Tool uses') &&
            !trimmed.match(/^Task\(.*\)$/) &&  // Skip Task tool status lines
            !trimmed.match(/^⎿\s+/) &&         // Skip task progress indicators
            !trimmed.includes('Initializing…') &&
            !trimmed.includes('ctrl+r to expand') &&
            !trimmed.includes('tool uses') &&
            !this.recentLines.has(trimmed)) {  // Skip duplicate lines
          this.responseBuffer.push(trimmed);
          this.recentLines.add(trimmed);
          this.lineTimestamps.set(trimmed, Date.now());
        }
      }
      // If we hit a new prompt or empty line after capturing, save the response
      else if ((trimmed === '' || trimmed.includes('│ >')) && this.responseBuffer.length > 0) {
        const response = this.responseBuffer.join('\n').trim();
        if (response && response !== this.lastLoggedClaude) {
          // Only log if we haven't logged this exact response before
          this.lastLoggedClaude = response;
          conversationParts.push(`Claude: ${response}\n`);
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