# claude-ci

A CLI tool that runs Claude in non-interactive mode with elegant streaming output formatting
and some additional useful command-line options

## Features

- Non-interactive execution of Claude commands
- Real-time streaming output with color formatting
- JSON stream parsing and pretty printing
- Support for passing options directly to Claude CLI
- Error handling with colored error messages
- Optional logging to file
- Retry support with automatic session resumption
- Working directory support

## Prerequisites

- Node.js >= 18.0.0
- Claude CLI installed and available in PATH

## Installation

### Using npx (no installation required)

You can run claude-ci directly without installing it globally:

```bash
npx @mneuhaus/claude-ci "Your prompt here"
```

### Global installation

```bash
npm install -g @mneuhaus/claude-ci
```

### From source

```bash
# Clone the repository
git clone https://github.com/juniperab/claude-ci.git
cd claude-ci

# Install dependencies
npm install

# Link globally to use as a command
npm link
```

## Usage

### Basic usage

```bash
# Run Claude with a prompt from the command line
claude-ci "Your prompt here"

# Run Claude with a prompt from standard input
cat prompt.txt | claude-ci
echo "What is 2+2?" | claude-ci

# Interactive mode - type prompt and press Ctrl-D to execute
claude-ci
```

### Options

```bash
# Show help
claude-ci -h
claude-ci --help

# Set working directory for claude command
claude-ci -d /tmp "List files"
claude-ci --directory /path/to/project "Analyze this codebase"

# Log all messages to a file
claude-ci -l output.log "Your prompt"
claude-ci --log session.txt "Your prompt"

# Retry on error with automatic session resumption
claude-ci -r "Complex task that might fail"
claude-ci --retry "Long running operation"

# Pass additional options to Claude
claude-ci "Your prompt" -- --model opus --temperature 0.7
```

### Examples

```bash
# Quick calculation
claude-ci "What is 2+2?"

# Using npx (no installation required)
npx @mneuhaus/claude-ci "What is 2+2?"

# Read from file
claude-ci < input.txt

# Pipe from command
cat README.md | claude-ci "Summarize this file"

# Work in specific directory with logging
claude-ci -d /project -l session.log "Run tests and fix any issues"

# Pass Claude-specific options
claude-ci "Write a poem" -- --model opus --temperature 0.9
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

This project is based on [auto-claude](https://github.com/juniperab/auto-claude) by juniperab. Thank you for the original Ruby implementation!
