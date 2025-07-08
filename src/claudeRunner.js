import { spawn } from 'child_process';
import ColorPrinter from './colorPrinter.js';
import MessageFormatter from './messageFormatter.js';
import fs from 'fs';
import path from 'path';

class ClaudeRunner {
  constructor({ claudeOptions = [], directory = null, logFile = null } = {}) {
    this.claudeOptions = claudeOptions;
    this.directory = directory;
    this.logFile = logFile;
    this.resultMetadata = null;
    this.error = null;
    this.colorPrinter = new ColorPrinter();

    // Initialize log file if provided
    if (this.logFile) {
      this.colorPrinter.setLogFile(this.logFile);
    }
  }

  async run(prompt) {
    this.colorPrinter.printMessage('---', { color: 'cyan' });

    try {
      let result;
      if (!this.directory) {
        if (this.logFile) {
          this.colorPrinter.printMessage(`Log file: ${this.logFile}`, { color: 'darkGray' });
        }
        result = await this.runInternal(prompt);
      } else {
        if (!fs.existsSync(this.directory) || !fs.statSync(this.directory).isDirectory()) {
          throw new Error(`Directory does not exist: ${this.directory}`);
        }
        this.colorPrinter.printMessage(`Working directory: ${this.directory}`, { color: 'darkGray' });
        if (this.logFile) {
          this.colorPrinter.printMessage(`Log file: ${this.logFile}`, { color: 'darkGray' });
        }
        
        const originalCwd = process.cwd();
        process.chdir(this.directory);
        try {
          result = await this.runInternal(prompt);
        } finally {
          process.chdir(originalCwd);
        }
      }

      this.colorPrinter.printMessage('---', { color: 'cyan' });

      // Write JSON metadata to log file if available
      if (this.logFile && this.resultMetadata) {
        this.writeMetadataJson();
      }

      // Throw error after all logging is complete
      if (this.error) {
        throw new Error(this.error);
      }

      return result;
    } finally {
      // Close log file if it was opened
      if (this.logFile) {
        this.colorPrinter.closeLogFile();
      }
    }
  }

  async runInternal(prompt) {
    this.printPrompt(prompt);
    const command = this.buildCommand();

    return new Promise((resolve, reject) => {
      let result = '';
      const args = command.slice(1);
      const child = spawn(command[0], args);

      // Write prompt and close stdin
      child.stdin.write(prompt);
      child.stdin.end();

      // Process streaming output
      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const json = this.parseJson(line);
          if (!json) continue;

          switch (json.type) {
            case 'assistant':
            case 'user':
              const messages = MessageFormatter.formatMessages(json);
              for (const msg of messages) {
                if (msg) {
                  this.colorPrinter.printMessage(msg, { color: 'white' });
                }
              }
              break;
            case 'result':
              const res = this.handleResult(json);
              if (res) result += res;
              break;
            case 'system':
              // Ignore system messages
              break;
            default:
              console.error(`Warning: Unexpected message type: ${json.type}`);
          }
        }
      });

      let errorOutput = '';
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          this.error = `Claude command failed with exit code ${code}: ${errorOutput}`;
          this.resultMetadata = this.resultMetadata || {};
          this.resultMetadata.success = false;
          this.resultMetadata.error_message = this.error;
        }

        if (this.resultMetadata) {
          this.printUsageStats();
        }

        if (this.error) {
          reject(new Error(this.error));
        } else {
          resolve(result);
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  buildCommand() {
    // Base command with required flags for streaming JSON
    const command = ['claude', '-p', '--verbose', '--output-format', 'stream-json'];
    
    // Add user-provided options
    command.push(...this.claudeOptions);
    
    return command;
  }

  parseJson(line) {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }

  handleResult(json) {
    if (json.is_error) {
      const errorMsg = json.result || json.error?.message || 'Unknown error';
      this.error = `Claude error: ${errorMsg}`;
      this.resultMetadata = { ...json, success: false, error_message: errorMsg };
    } else if (json.subtype === 'success') {
      this.resultMetadata = { ...json, success: true };
      return json.result || '';
    } else {
      this.error = `Claude did not complete successfully: ${JSON.stringify(json)}`;
      this.resultMetadata = { ...json, success: false, error_message: this.error };
    }
    return null;
  }

  printUsageStats() {
    if (!this.resultMetadata) return;

    const cost = this.resultMetadata.total_cost_usd || 0;
    const numTurns = this.resultMetadata.num_turns || 0;
    const durationMs = this.resultMetadata.duration_ms || 0;
    const inputTokens = this.resultMetadata.usage?.input_tokens || 0;
    const outputTokens = this.resultMetadata.usage?.output_tokens || 0;
    const sessionId = this.resultMetadata.session_id;
    const durationSeconds = durationMs / 1000.0;

    const success = this.resultMetadata.success;
    this.colorPrinter.printStat(`Success: ${success}`);
    if (numTurns > 0) this.colorPrinter.printStat(`Turns: ${numTurns}`);
    if (durationMs > 0) this.colorPrinter.printStat(`Duration: ${durationSeconds.toFixed(1)}s`);
    this.colorPrinter.printStat(`Cost: $${cost.toFixed(6)}`);
    this.colorPrinter.printStat(`Tokens: ${inputTokens} up, ${outputTokens} down`);
    if (sessionId) this.colorPrinter.printStat(`Session ID: ${sessionId}`);
  }

  printPrompt(prompt, maxLines = 5) {
    this.colorPrinter.printMessage(prompt, { color: 'blue', maxLines });
  }

  writeMetadataJson() {
    if (!this.resultMetadata) return;

    const metadata = {
      success: this.resultMetadata.success,
      turns: this.resultMetadata.num_turns || 0,
      duration_ms: this.resultMetadata.duration_ms || 0,
      duration_s: (this.resultMetadata.duration_ms || 0) / 1000.0,
      cost_usd: this.resultMetadata.total_cost_usd || 0,
      input_tokens: this.resultMetadata.usage?.input_tokens || 0,
      output_tokens: this.resultMetadata.usage?.output_tokens || 0,
      session_id: this.resultMetadata.session_id
    };

    if (this.resultMetadata.error_message) {
      metadata.error_message = this.resultMetadata.error_message;
    }

    this.colorPrinter.logToFile(JSON.stringify(metadata));
  }
}

export default ClaudeRunner;