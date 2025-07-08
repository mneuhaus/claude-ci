# auto-claude

A CLI tool that runs Claude in non-interactive mode with elegant streaming output formatting
and some additional useful command-line options

## Features

- Non-interactive execution of Claude commands
- Real-time streaming output with color formatting
- JSON stream parsing and pretty printing
- Support for passing options directly to Claude CLI
- Error handling with colored error messages

## Prerequisites

- Ruby 3.4.0
- Claude CLI installed and available in PATH

## Installation

### From source

```bash
# Clone the repository
git clone https://github.com/juniperab/auto-claude.git
cd auto-claude

# Install dependencies
bundle install

# Build the gem
gem build auto_claude.gemspec

# Install the gem
gem install ./auto_claude-*.gem
```

## Usage

### Basic usage

```bash
# Run Claude with a prompt from the command line
auto-claude "Your prompt here"

# Run Claude with a prompt from standard input
cat prompt.txt | auto-claude

# Pass additional options to Claude
auto-claude "Your prompt" -- --model claude-4-opus --temperature 0.7
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
