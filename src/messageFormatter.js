import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import os from 'os';

class MessageFormatter {
  static formatMessages(json) {
    const messages = json.message?.content || [];
    return messages.map(msg => {
      const formatted = this.formatMessage(msg);
      // Handle objects that contain formatting info
      if (formatted && typeof formatted === 'object' && formatted.text) {
        return formatted;
      }
      return formatted;
    });
  }

  static formatMessage(message) {
    switch (message.type) {
      case 'text':
        return `→ ${this.formatText(message.text)}`;
      
      case 'tool_use': {
        const name = this.formatToolName(message.name);
        const input = this.filterInput(message.input || {});
        const isMcpTool = message.name.includes('__');

        switch (message.name) {
          case 'Task':
            return { text: `→ ${name}${this.formatTaskInput(input)}`, type: 'tool_use' };
          case 'TodoWrite':
            return { text: `→ ${name}${this.formatTodoWriteInput(input)}`, type: 'tool_use' };
          case 'Bash':
          case 'Read':
          case 'Edit':
            return { text: `→ ${name}(${this.formatArguments(input)})`, type: 'tool_use' };
          default:
            this.logUnhandledMessage(message);
            const formattedArgs = this.formatText(yaml.stringify(input));
            if (isMcpTool) {
              return { text: `→ ${name} ${formattedArgs}`, type: 'mcp_tool' };
            }
            return { text: `→ ${name} ${formattedArgs}`, type: 'tool_use' };
        }
      }
      
      case 'tool_result':
        // Format tool results
        return this.formatToolResult(message);
      
      default: {
        const filtered = { ...message };
        delete filtered.id;
        return yaml.stringify(filtered);
      }
    }
  }

  static formatText(text, preserveIndent = false) {
    if (!text) return '';

    if (preserveIndent) {
      // For pre-formatted content like JSON, normalize and add consistent indentation
      const lines = text.split('\n');
      
      // Find the minimum indentation (excluding empty lines)
      let minIndent = Infinity;
      lines.forEach((line, i) => {
        if (line.trim()) {
          const leadingSpaces = line.match(/^[\s]*/)[0].length;
          minIndent = Math.min(minIndent, leadingSpaces);
        }
      });
      
      // Remove the minimum indentation from all lines and add our tab
      const result = lines
        .map((line, i) => {
          if (line.trim()) {
            // Remove common leading whitespace and add tab
            const formatted = `\t${line.substring(minIndent)}`;
            return formatted;
          }
          return line; // Keep empty lines as-is
        })
        .join('\n');
        
      return result;
    }

    return text
      .split('\n')
      .map(line => `\t${line}`)
      .join('\n')
      .trimStart();
  }

  static formatToolName(name) {
    // Convert tool names like mcp__gitlab__search_repositories to more readable format
    if (name.includes('__')) {
      // MCP tool format: mcp__provider__action
      const parts = name.split('__');
      if (parts.length >= 3 && parts[0] === 'mcp') {
        // Convert snake_case to Title Case for the action part
        const provider = parts[1];
        const action = parts.slice(2).join('_')
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        return `[${provider}] ${action}`;
      }
    }
    return name;
  }

  static formatToolResult(message) {
    const toolUseId = message.tool_use_id;
    const content = message.content;
    
    if (!content) {
      return { text: `← Tool result (empty)\n`, type: 'tool_result' };
    }

    // Handle different content formats
    let formattedContent;
    let isError = false;
    
    if (Array.isArray(content)) {
      // Content is an array of items
      formattedContent = content
        .map(item => {
          if (item.type === 'text') {
            const text = item.text;
            // Check if the text looks like JSON
            const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
            return this.formatText(text, isJson);
          }
          return this.formatText(yaml.stringify(item));
        })
        .join('\n');
    } else if (typeof content === 'string') {
      // Check if it's an error message
      isError = content.includes('MCP error') || content.includes('Error:') || content.includes('error');
      
      // Check if content contains JSON (might be mixed with text)
      const lines = content.split('\n');
      const hasJsonStart = lines.some(line => line.trim() === '{' || line.trim() === '[');
      
      // If it has JSON brackets on their own lines, it's likely formatted JSON
      formattedContent = this.formatText(content, hasJsonStart);
    } else {
      // Content is an object or other type
      formattedContent = this.formatText(yaml.stringify(content));
    }

    const type = isError ? 'tool_error' : 'tool_result';
    return { text: `← Tool result:\n${formattedContent}\n`, type };
  }

  static formatTaskInput(input) {
    const prompt = input.prompt;
    if (!prompt) {
      return `(${this.formatArguments(input)})`;
    }

    const promptLines = prompt
      .split('\n')
      .filter(line => line.trim())
      .map(line => `\t${line}`)
      .join('\n');
    
    const args = this.formatArguments(this.filterInput(input, ['prompt']));
    return `(${args})\n${promptLines}`;
  }

  static formatTodoWriteInput(input) {
    const todos = input.todos || [];
    const todoText = todos.map(item => this.formatTodoWriteInputItem(item)).join('\n');
    const args = this.formatArguments(this.filterInput(input, ['todos']));
    return `(${args})\n${todoText}`;
  }

  static formatTodoWriteInputItem(item) {
    const id = item.id;
    const content = item.content;
    let status;
    
    switch (item.status) {
      case 'pending':
        status = '[ ]';
        break;
      case 'in_progress':
        status = '[-]';
        break;
      case 'completed':
        status = '[x]';
        break;
      default:
        status = '[?]';
    }
    
    return `\t${id}. ${status} ${content}`;
  }

  static formatArguments(args) {
    if (!args || Object.keys(args).length === 0) {
      return '';
    }

    const entries = Object.entries(args);
    if (entries.length === 1) {
      return JSON.stringify(entries[0][1]);
    }

    return entries
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  }

  static filterInput(input, excludeKeys = ['description', 'old_string', 'new_string']) {
    const filtered = { ...input };
    excludeKeys.forEach(key => delete filtered[key]);
    return filtered;
  }

  static logUnhandledMessage(message) {
    try {
      const logDir = path.join(os.homedir(), '.claude');
      const logFile = path.join(logDir, 'unhandled_message_types.txt');

      // Create directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append the message to the file
      fs.appendFileSync(logFile, JSON.stringify(message) + '\n');
    } catch (e) {
      // Silently ignore any errors to avoid disrupting the main flow
      console.error(`Warning: Could not log unhandled message type: ${e.message}`);
    }
  }
}

export default MessageFormatter;