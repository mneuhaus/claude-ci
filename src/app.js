import { Command } from 'commander';
import ClaudeRunner from './claudeRunner.js';
import { VERSION } from './version.js';

class App {
  static start(args = process.argv.slice(2)) {
    let prompt = null;
    let claudeOptions = [];
    let directory = null;
    let logFile = null;
    let retryOnError = false;

    // Split arguments at '--' if present
    const separatorIndex = args.indexOf('--');
    let mainArgs = args;
    
    if (separatorIndex !== -1) {
      mainArgs = args.slice(0, separatorIndex);
      claudeOptions = args.slice(separatorIndex + 1);
    }

    // Parse main arguments
    let i = 0;
    while (i < mainArgs.length) {
      const arg = mainArgs[i];

      if (arg === '-h' || arg === '--help') {
        this.showHelp();
        process.exit(0);
      } else if (arg === '-d' || arg === '--directory') {
        i++;
        if (i >= mainArgs.length) {
          console.error(`Error: ${arg} requires a directory argument`);
          this.showUsageError();
          process.exit(1);
        }
        directory = mainArgs[i];
      } else if (arg === '-l' || arg === '--log') {
        i++;
        if (i >= mainArgs.length) {
          console.error(`Error: ${arg} requires a file argument`);
          this.showUsageError();
          process.exit(1);
        }
        logFile = mainArgs[i];
      } else if (arg === '-r' || arg === '--retry') {
        retryOnError = true;
      } else if (arg.startsWith('-')) {
        console.error(`Error: Unrecognized option '${arg}'`);
        this.showUsageError();
        process.exit(1);
      } else {
        if (prompt === null) {
          prompt = arg;
        } else {
          console.error('Error: Too many arguments');
          this.showUsageError();
          process.exit(1);
        }
      }
      i++;
    }

    // Validate claude options
    if (claudeOptions.length > 0) {
      const error = this.validateClaudeOptions(claudeOptions);
      if (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    }

    // Create app instance and process
    const app = new App();
    app.claudeOptions = claudeOptions;
    app.directory = directory;
    app.logFile = logFile;
    app.retryOnError = retryOnError;
    app.process(prompt);
  }

  static showUsageError() {
    console.log('Usage: claude-ci [OPTIONS] [PROMPT]');
    console.log('       claude-ci < input.txt');
    console.log("       echo 'text' | claude-ci");
    console.log('');
    console.log("Run 'claude-ci -h' or 'claude-ci --help' for more information.");
  }

  static showHelp() {
    console.log('claude-ci - Run Claude non-interactively and format its streaming output');
    console.log('');
    console.log('Usage: claude-ci [OPTIONS] [PROMPT] [-- CLAUDE_OPTIONS]');
    console.log('       claude-ci < input.txt');
    console.log("       echo 'text' | claude-ci");
    console.log('');
    console.log('Options:');
    console.log('  -h, --help              Show this help message');
    console.log('  -d, --directory DIR     Set working directory for claude command');
    console.log('  -l, --log FILE          Log all messages to FILE');
    console.log('  -r, --retry             Retry up to 3 times on error using --resume');
    console.log('  --                      Pass remaining arguments to claude command');
    console.log('');
    console.log('Examples:');
    console.log('  claude-ci "What is 2+2?"                    # Quick prompt');
    console.log('  claude-ci -d /tmp "List files"               # Run in /tmp directory');
    console.log('  claude-ci < input.txt                        # Read from file');
    console.log('  cat input.txt | claude-ci                    # Pipe from command');
    console.log('  claude-ci "prompt" -- --model opus           # Pass options to claude');
  }

  static validateClaudeOptions(options) {
    const forbiddenFlags = {
      '--verbose': "The --verbose flag conflicts with claude-ci's output formatting",
      '-p': "The -p/--print flag conflicts with claude-ci's output handling",
      '--print': "The -p/--print flag conflicts with claude-ci's output handling",
      '--output-format': 'The --output-format flag is managed by claude-ci',
      '--input-format': 'The --input-format flag is managed by claude-ci',
      '-v': 'The -v/--version flag cannot be passed through',
      '--version': 'The -v/--version flag cannot be passed through',
      '-h': 'The -h/--help flag cannot be passed through',
      '--help': 'The -h/--help flag cannot be passed through'
    };

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];

      if (forbiddenFlags[opt]) {
        return forbiddenFlags[opt];
      }

      if (!opt.startsWith('-')) {
        if (i > 0 && options[i - 1].startsWith('-')) {
          // This is likely a value for the previous option
        } else {
          return `Cannot pass non-option arguments to claude (found: '${opt}'). Only flags starting with '-' are allowed.`;
        }
      }
    }

    return null;
  }

  async process(prompt = null) {
    let input = prompt;

    // Read from stdin if no prompt provided
    if (!input) {
      if (process.stdin.isTTY) {
        // Interactive mode - read until EOF (Ctrl-D)
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString();
      } else {
        // Piped input
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString();
      }
    }

    // Run claude with the prompt
    const maxAttempts = this.retryOnError ? 3 : 1;
    let attempt = 0;
    let lastSessionId = null;
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt++;

      // Add --resume option if we have a session ID from previous attempt
      let claudeOptions = this.claudeOptions || [];
      if (lastSessionId && attempt > 1) {
        if (!claudeOptions.includes('--resume')) {
          claudeOptions = [...claudeOptions, '--resume', lastSessionId];
          console.error(`  Retrying with --resume ${lastSessionId} (attempt ${attempt}/${maxAttempts})...`);
        }
      }

      let runner;
      try {
        runner = new ClaudeRunner({
          claudeOptions,
          directory: this.directory,
          logFile: this.logFile
        });
        
        const result = await runner.run(input);
        console.log(result);
        return; // Success
      } catch (e) {
        lastError = e;
        // Try to extract session_id from the runner
        lastSessionId = runner?.resultMetadata?.session_id;

        if (attempt < maxAttempts && this.retryOnError) {
          console.error(`  Error occurred: ${e.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error(`  Error: ${e.message}`);
          process.exit(1);
        }
      }
    }
  }
}

export default App;