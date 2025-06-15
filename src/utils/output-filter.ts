export class OutputFilter {
  private buffer = '';
  private inResponse = false;
  private responseBuffer = '';
  
  process(text: string): { conversation?: string; ui?: string } {
    this.buffer += text;
    
    const result: { conversation?: string; ui?: string } = {};
    
    // Look for conversation markers
    const lines = this.buffer.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      // Skip UI elements (boxes, prompts, etc)
      if (line.includes('╭') || line.includes('╰') || line.includes('│') || 
          line.includes('─') || line.includes('※') || line.includes('◯')) {
        result.ui = (result.ui || '') + line + '\n';
        continue;
      }
      
      // Skip empty lines in UI context
      if (line.trim() === '' && !this.inResponse) {
        continue;
      }
      
      // Detect start of response (⏺ marker)
      if (line.includes('⏺')) {
        this.inResponse = true;
        this.responseBuffer = line + '\n';
        continue;
      }
      
      // Detect user input (> marker at start)
      if (line.startsWith('>')) {
        this.inResponse = false;
        if (this.responseBuffer) {
          processedLines.push(this.responseBuffer.trim());
          this.responseBuffer = '';
        }
        processedLines.push('User: ' + line.substring(1).trim());
        continue;
      }
      
      // If we're in a response, buffer it
      if (this.inResponse) {
        this.responseBuffer += line + '\n';
      }
    }
    
    // Flush any remaining response
    if (this.responseBuffer && this.inResponse) {
      processedLines.push(this.responseBuffer.trim());
    }
    
    if (processedLines.length > 0) {
      result.conversation = processedLines.join('\n\n');
    }
    
    // Clear processed content from buffer
    this.buffer = lines[lines.length - 1] || '';
    
    return result;
  }
  
  flush(): string {
    if (this.responseBuffer) {
      return this.responseBuffer.trim();
    }
    return '';
  }
}