require "json"
require "open3"
require "active_support/all"

module AutoClaude
  class ClaudeRunner

    def initialize(claude_options: [], directory: nil, log_file: nil)
      @claude_options = claude_options
      @directory = directory
      @log_file = log_file
      @result_metadata = nil
      @error = nil

      # Initialize log file if provided
      if @log_file
        ColorPrinter.set_log_file(@log_file)
      end
    end

    def run(prompt)
      ColorPrinter.print_message "---", color: :cyan

      result = if @directory.blank?
        # Print log file location if provided
        if @log_file
          ColorPrinter.print_message "Log file: #{@log_file}", color: :dark_gray
        end
        run_internal(prompt)
      else
        raise "Directory does not exist: #{@directory}" unless File.directory?(@directory)
        ColorPrinter.print_message "Working directory: #{@directory}", color: :dark_gray
        # Print log file location if provided
        if @log_file
          ColorPrinter.print_message "Log file: #{@log_file}", color: :dark_gray
        end
        Dir.chdir(@directory) do
          run_internal(prompt)
        end
      end

      ColorPrinter.print_message "---", color: :cyan

      # Write JSON metadata to log file if available
      if @log_file && @result_metadata
        write_metadata_json
      end

      # Raise error after all logging is complete
      raise @error unless @error.nil?

      result
    ensure
      # Close log file if it was opened
      ColorPrinter.close_log_file if @log_file
    end

    private

    def run_internal(prompt)
      print_prompt prompt
      command = build_command
      # ColorPrinter.print_message "> #{command.join(" ")}", color: :cyan
      # ColorPrinter.print_message "---", color: :cyan

      result = ""

      begin
        Open3.popen3(*command) do |stdin, stdout, stderr, wait_thread|
          # Write prompt and close stdin
          stdin.write(prompt)
          stdin.close

          # Process streaming output
          stdout.each_line do |line|
            json = parse_json(line)
            next unless json

            case json["type"]
            when "assistant", "user"
              MessageFormatter.format_messages(json).each do |msg|
                next unless msg # Skip nil messages
                ColorPrinter.print_message msg, color: :white
              end
            when "result"
              result += handle_result(json) || ""
            when "system"
              # Ignore system messages
            else
              $stderr.puts "Warning: Unexpected message type: #{json["type"]}"
            end
          end

          # Check for errors
          exit_status = wait_thread.value
          unless exit_status.success?
            error_output = stderr.read
            @error = "Claude command failed with exit code #{exit_status.exitstatus}: #{error_output}"
            # Create minimal metadata for logging
            @result_metadata ||= {}
            @result_metadata["success"] = false
            @result_metadata["error_message"] = @error
          end
        end

        if @result_metadata
          print_usage_stats
        end

        result
      end
    end

    def build_command
      # Base command with required flags for streaming JSON
      command = %w[claude -p --verbose --output-format stream-json]

      # Add user-provided options
      command.concat(@claude_options)

      command
    end

    def parse_json(line)
      JSON.parse(line)
    rescue JSON::ParserError
      nil
    end

    def handle_result(json)
      if json["is_error"]
        error_msg = json["result"] || json.dig("error", "message") || "Unknown error"
        @error = "Claude error: #{error_msg}"
        # Store error info in metadata
        @result_metadata = json.merge("success" => false, "error_message" => error_msg)
      elsif json["subtype"] == "success"
        # Store success info in metadata
        @result_metadata = json.merge("success" => true)
        return json["result"] || ""
      else
        @error = "Claude did not complete successfully: #{json.inspect}"
        @result_metadata = json.merge("success" => false, "error_message" => @error)
      end
      nil
    end


    def print_usage_stats
      return unless @result_metadata

      cost = @result_metadata["total_cost_usd"] || 0
      num_turns = @result_metadata["num_turns"] || 0
      duration_ms = @result_metadata["duration_ms"] || 0
      input_tokens = @result_metadata["usage"]["input_tokens"] || 0
      output_tokens = @result_metadata["usage"]["output_tokens"] || 0
      session_id = @result_metadata["session_id"]

      duration_seconds = duration_ms / 1000.0

      # Print stats in dark gray
      success = @result_metadata["success"]
      ColorPrinter.print_stat "Success: #{success}"
      ColorPrinter.print_stat "Turns: #{num_turns}" if num_turns > 0
      ColorPrinter.print_stat "Duration: #{'%.1f' % duration_seconds}s" if duration_ms > 0
      ColorPrinter.print_stat "Cost: $#{'%.6f' % cost}"
      ColorPrinter.print_stat "Tokens: #{input_tokens} up, #{output_tokens} down"
      ColorPrinter.print_stat "Session ID: #{session_id}" if session_id
    end

    def print_prompt(prompt, max_lines: 5)
      ColorPrinter.print_message prompt, color: :blue, max_lines: max_lines
    end

    def write_metadata_json
      return unless @result_metadata

      # Extract metadata
      metadata = {
        success: @result_metadata["success"],
        turns: @result_metadata["num_turns"] || 0,
        duration_ms: @result_metadata["duration_ms"] || 0,
        duration_s: (@result_metadata["duration_ms"] || 0) / 1000.0,
        cost_usd: @result_metadata["total_cost_usd"] || 0,
        input_tokens: @result_metadata["usage"]["input_tokens"] || 0,
        output_tokens: @result_metadata["usage"]["output_tokens"] || 0,
        session_id: @result_metadata["session_id"]
      }

      # Add error message if present
      if @result_metadata["error_message"]
        metadata[:error_message] = @result_metadata["error_message"]
      end

      # Write JSON on a single line
      ColorPrinter.log_to_file(metadata.to_json)
    end
  end
end
