module AutoClaude
  class ColorPrinter
    # Color enum with regular and bold versions
    COLORS = {
      blue: {
        regular: "\e[94m",
        bold: "\e[1;94m"
      },
      cyan: {
        regular: "\e[96m",
        bold: "\e[1;96m"
      },
      light_gray: {
        regular: "\e[37m",
        bold: "\e[1;37m"
      },
      dark_gray: {
        regular: "\e[90m",
        bold: "\e[1;90m"
      },
      red: {
        regular: "\e[31m",
        bold: "\e[1;31m"
      },
      white: {
        regular: "\e[97m",
        bold: "\e[1;97m"
      }
    }.freeze
    
    RESET = "\e[0m".freeze
    
    class << self
      attr_accessor :log_file_handle
      
      def set_log_file(filename)
        @log_file_handle = File.open(filename, 'w')
        @log_file_handle.sync = true  # Ensure immediate write
      rescue => e
        $stderr.puts "Warning: Failed to open log file '#{filename}': #{e.message}"
        @log_file_handle = nil
      end
      
      def close_log_file
        @log_file_handle&.close
        @log_file_handle = nil
      end
      
      def log_to_file(message)
        return unless @log_file_handle
        
        # Strip ANSI color codes for log file
        clean_message = message.gsub(/\e\[[0-9;]*m/, '')
        @log_file_handle.puts(clean_message)
      rescue => e
        $stderr.puts "Warning: Failed to write to log file: #{e.message}"
      end
      
      def print_message(message, color: :cyan, max_lines: 5)
        return unless message
        
        lines = message.lines
        total_lines = lines.length
        
        # Store lines for logging
        logged_lines = []
        
        # Print first line in bold
        if lines.any?
          first_line = lines.shift
          color_code = COLORS.dig(color, :bold) || COLORS[:cyan][:bold]
          output_line = "  #{color_code}#{first_line.chomp}#{RESET}"
          $stderr.puts output_line
          logged_lines << "  #{first_line.chomp}"
        end
        
        # Print remaining lines in regular color
        if lines.any?
          regular_color = COLORS.dig(color, :regular) || COLORS[:cyan][:regular]
          lines.first(max_lines - 1).each do |line|
            output_line = "  #{regular_color}#{line.chomp}#{RESET}"
            $stderr.puts output_line
            logged_lines << "  #{line.chomp}"
          end
        end
        
        # Show truncation notice if needed
        if total_lines > max_lines
          remaining = total_lines - max_lines
          truncation_msg = "    + #{remaining} line#{remaining == 1 ? '' : 's'} not shown"
          $stderr.puts "    #{COLORS[:light_gray][:regular]}#{truncation_msg}#{RESET}"
          logged_lines << "    #{truncation_msg}"
        end
        
        # Log all lines to file
        logged_lines.each { |line| log_to_file(line) }
      end
      
      def print_stat(message)
        output_line = "  #{COLORS[:dark_gray][:regular]}#{message}#{RESET}"
        $stderr.puts output_line
        log_to_file("  #{message}")
      end
    end
  end
end