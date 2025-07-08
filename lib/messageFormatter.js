import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import os from 'os';

class MessageFormatter {
  static formatMessages(json) {
    const messages = json.message?.content || [];
    return messages.map(msg => this.formatMessage(msg));
  }

  static formatMessage(message) {
    switch (message.type) {
      case 'text':
        return `→ ${this.formatText(message.text)}`;
      
      case 'tool_use': {
        const name = message.name;
        const input = this.filterInput(message.input || {});

        switch (name) {
          case 'Task':
            return `→ ${name}${this.formatTaskInput(input)}\n`;
          case 'TodoWrite':
            return `→ ${name}${this.formatTodoWriteInput(input)}\n`;
          case 'Bash':
          case 'Read':
          case 'Edit':
            return `→ ${name}(${this.formatArguments(input)})\n`;
          default:
            this.logUnhandledMessage(message);
            return `→ ${name} ${this.formatText(yaml.stringify(input))}`;
        }
      }
      
      case 'tool_result':
        // Ignore these message types
        return null;
      
      default: {
        const filtered = { ...message };
        delete filtered.id;
        return yaml.stringify(filtered);
      }
    }
  }

  static formatText(text) {
    if (!text) return '';

    return text
      .split('\n')
      .map(line => `\t${line}`)
      .join('\n')
      .trimStart();
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