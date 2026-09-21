type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private format(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
  }

  public debug(message: string, context?: Record<string, unknown>) {
    if (this.isDevelopment) {
      const entry: LogEntry = { level: 'DEBUG', message, context, timestamp: new Date().toISOString() };
      console.debug(this.format(entry), context ?? '');
    }
  }

  public info(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'INFO', message, context, timestamp: new Date().toISOString() };
    console.info(this.format(entry), context ?? '');
  }

  public warn(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'WARN', message, context, timestamp: new Date().toISOString() };
    console.warn(this.format(entry), context ?? '');
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: 'ERROR',
      message,
      context: { ...context, error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
    console.error(this.format(entry), entry.context);
  }
}

export const logger = new Logger();
