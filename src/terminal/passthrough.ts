import { Transform, TransformCallback, Readable, Writable } from 'stream';
import { EventEmitter } from 'events';

export class Passthrough extends EventEmitter {
  private transform: Transform;
  private destroyed = false;

  constructor(input: Readable, output: Writable) {
    super();

    this.transform = new Transform({
      transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback) {
        // Pass data through unchanged
        callback(null, chunk);
      }
    });

    // Set up error handling
    input.on('error', (err) => this.handleError(err));
    output.on('error', (err) => this.handleError(err));
    this.transform.on('error', (err) => this.handleError(err));

    // Emit data events for monitoring
    this.transform.on('data', (chunk) => {
      this.emit('data', chunk);
    });

    // Set up the pipeline
    input.pipe(this.transform).pipe(output);
  }

  private handleError(error: Error): void {
    if (!this.destroyed) {
      this.emit('error', error);
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyed = true;
      this.transform.destroy();
      this.removeAllListeners();
    }
  }
}