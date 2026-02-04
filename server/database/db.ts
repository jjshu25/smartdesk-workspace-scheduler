import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

// Create database file in server directory
const dbPath = path.join(dataDir, 'smartdesk.db');

// Initialize database
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
export function initializeDatabase() {
  // Create sessions table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS pc_sessions (
      id TEXT PRIMARY KEY,
      pc_id TEXT NOT NULL,
      pc_name TEXT NOT NULL,
      user_name TEXT NOT NULL,
      connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      session_duration INTEGER DEFAULT 0,
      allocated_duration INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'terminated')),
      desk_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      cpu_usage REAL DEFAULT 0,
      memory_usage REAL DEFAULT 0,
      disk_usage REAL DEFAULT 0,
      temperature REAL DEFAULT 0,
      network_speed REAL DEFAULT 0,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES pc_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES pc_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pc_sessions_pc_id ON pc_sessions(pc_id);
    CREATE INDEX IF NOT EXISTS idx_pc_sessions_connected_at ON pc_sessions(connected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pc_sessions_status ON pc_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
  `);

  console.log('✅ Database initialized successfully');
}

// Close database on process exit
process.on('exit', () => {
  db.close();
});
