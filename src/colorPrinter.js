import fs from 'fs';
import chalk from 'chalk';

class ColorPrinter {
  constructor() {
    this.logFileHandle = null;
    
    // Color mapping
    this.colors = {
      blue: {
        regular: chalk.blueBright,
        bold: chalk.bold.blueBright
      },
      cyan: {
        regular: chalk.cyanBright,
        bold: chalk.bold.cyanBright
      },
      lightGray: {
        regular: chalk.gray,
        bold: chalk.bold.gray
      },
      darkGray: {
        regular: chalk.dim.gray,
        bold: chalk.bold.dim.gray
      },
      red: {
        regular: chalk.red,
        bold: chalk.bold.red
      },
      white: {
        regular: chalk.whiteBright,
        bold: chalk.bold.whiteBright
      }
    };
  }

  setLogFile(filename) {
    try {
      this.logFileHandle = fs.createWriteStream(filename, { flags: 'w' });
    } catch (e) {
      console.error(`Warning: Failed to open log file '${filename}': ${e.message}`);
      this.logFileHandle = null;
    }
  }

  closeLogFile() {
    if (this.logFileHandle) {
      this.logFileHandle.end();
      this.logFileHandle = null;
    }
  }

  logToFile(message) {
    if (!this.logFileHandle) return;

    try {
      // Strip ANSI color codes for log file
      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
      this.logFileHandle.write(cleanMessage + '\n');
    } catch (e) {
      console.error(`Warning: Failed to write to log file: ${e.message}`);
    }
  }

  printMessage(message, { color = 'cyan', maxLines = 5 } = {}) {
    if (!message) return;

    const lines = message.split('\n');
    const totalLines = lines.length;
    const loggedLines = [];

    // Print first line in bold
    if (lines.length > 0) {
      const firstLine = lines.shift();
      const colorFn = this.colors[color]?.bold || this.colors.cyan.bold;
      const outputLine = `  ${colorFn(firstLine)}`;
      console.error(outputLine);
      loggedLines.push(`  ${firstLine}`);
    }

    // Print remaining lines in regular color (all of them)
    if (lines.length > 0) {
      const regularColorFn = this.colors[color]?.regular || this.colors.cyan.regular;
      lines.forEach(line => {
        const outputLine = `  ${regularColorFn(line)}`;
        console.error(outputLine);
        loggedLines.push(`  ${line}`);
      });
    }

    // Log all lines to file
    loggedLines.forEach(line => this.logToFile(line));
  }

  printStat(message) {
    const outputLine = `  ${this.colors.darkGray.regular(message)}`;
    console.error(outputLine);
    this.logToFile(`  ${message}`);
  }
}

export default ColorPrinter;