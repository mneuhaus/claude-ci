require "json"
require "yaml"
require "active_support/core_ext/hash/except"
require "fileutils"

module AutoClaude
  module MessageFormatter
    extend self

    def format_messages(json)
      messages = json.dig("message", "content") || []
      messages.map(&method(:format_message))
    end

    private

    def format_message(message)
      case message["type"]
      when "text"
        "→ #{format_text(message["text"])}"
      when "tool_use"
        name = message["name"]
        input = message["input"]&.except("description", "old_string", "new_string") || {}

        case name
        when "Task"
          "→ #{name}#{format_task_input(input)}\n"
        when "TodoWrite"
          "→ #{name}#{format_todo_write_input(input)}\n"
        when "Bash", "Read", "Edit"
          "→ #{name}(#{format_arguments(input)})\n"
        else
          log_unhandled_message(message)
          "→ #{name} #{format_text(input.to_yaml)}"
        end
      when "tool_result"
        # Ignore these message types
        nil
      else
        message.except("id").to_yaml
      end
    end

    def format_text(text)
      return "" if text.nil? || text.empty?

      text.lines.map do |line|
        "\t#{line}"
      end.join.lstrip
    end

    def format_task_input(input)
      prompt = input["prompt"]
      return "(#{format_arguments(input)})" unless prompt

      prompt_lines = prompt.lines.reject(&:empty?).map { |line| "\t#{line}" }.join
      args = format_arguments(input.except("prompt"))
      "(#{args})\n#{prompt_lines}"
    end

    def format_todo_write_input(input)
      todos = input["todos"] || []
      todo_text = todos.map { |item| format_todo_write_input_item(item) }.join("\n")
      args = format_arguments(input.except("todos"))
      "(#{args})\n#{todo_text}"
    end

    def format_todo_write_input_item(item)
      id = item["id"]
      content = item["content"]
      status = case item["status"]
      when "pending"
        "[ ]"
      when "in_progress"
        "[-]"
      when "completed"
        "[x]"
      else
        "[?]"
      end
      "\t#{id}. #{status} #{content}"
    end

    def format_arguments(arguments)
      return "" if arguments.nil? || arguments.empty?

      if arguments.length == 1
        arguments.first[1].to_json
      else
        arguments.map do |key, value|
          "#{key}: #{value.to_json}"
        end.join(", ")
      end
    end

    def log_unhandled_message(message)
      log_dir = File.expand_path("~/.claude")
      log_file = File.join(log_dir, "unhandled_message_types.txt")

      # Create directory if it doesn't exist
      FileUtils.mkdir_p(log_dir)

      # Append the message to the file
      File.open(log_file, "a") do |f|
        f.puts message.inspect
      end
    rescue => e
      # Silently ignore any errors to avoid disrupting the main flow
      $stderr.puts "Warning: Could not log unhandled message type: #{e.message}"
    end
  end
end
