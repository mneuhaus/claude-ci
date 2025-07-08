require_relative "lib/auto_claude/version"

Gem::Specification.new do |spec|
  spec.name = "auto_claude"
  spec.version = AutoClaude::VERSION
  spec.authors = ["Juniper Alanna Berry"]
  spec.email = ["juniper@stormchasers.ca"]

  spec.summary = "Run Claude non-interactively and format its streaming output elegantly"
  spec.description = "A CLI tool that runs Claude in non-interactive mode with elegant streaming output formatting and some additional useful command-line options"
  spec.homepage = "https://github.com/juniperab/auto-claude"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.4.0"

  spec.files = Dir["lib/**/*", "bin/*", "README.md", "LICENSE"]
  spec.bindir = "bin"
  spec.executables = ["auto-claude"]
  spec.require_paths = ["lib"]

  spec.add_dependency "activesupport"
  spec.add_dependency "thor"
  spec.add_dependency "zeitwerk"
end
