import { db } from '../database/db.js';

export interface SessionLog {
  id: string;
  pcId: string;
  pcName: string;
  userName: string;
  connectedAt: Date;
  disconnectedAt?: Date;
  sessionDuration: number;
  allocatedDuration: number;
  status: 'active' | 'completed' | 'terminated';
  deskId?: string;
}

export interface SessionFilter {
  pcId?: string;
  status?: 'active' | 'completed' | 'terminated';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class SessionRepository {
  /**
   * Create a new session log
   */
  static createSession(session: SessionLog): SessionLog {
    const stmt = db.prepare(`
      INSERT INTO pc_sessions (
        id, pc_id, pc_name, user_name, connected_at, 
        session_duration, allocated_duration, status, desk_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.pcId,
      session.pcName,
      session.userName,
      session.connectedAt.toISOString(),
      session.sessionDuration,
      session.allocatedDuration,
      session.status,
      session.deskId || null
    );

    return session;
  }

  /**
   * Update an existing session
   */
  static updateSession(sessionId: string, updates: Partial<SessionLog>): SessionLog | null {
    const session = this.getSessionById(sessionId);
    if (!session) return null;

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.disconnectedAt !== undefined) {
      updateFields.push('disconnected_at = ?');
      updateValues.push(updates.disconnectedAt?.toISOString() || null);
    }

    if (updates.sessionDuration !== undefined) {
      updateFields.push('session_duration = ?');
      updateValues.push(updates.sessionDuration);
    }

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = db.prepare(`
      UPDATE pc_sessions
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    updateValues.push(sessionId);
    stmt.run(...updateValues);

    return this.getSessionById(sessionId);
  }

  /**
   * Get a session by ID
   */
  static getSessionById(sessionId: string): SessionLog | null {
    const stmt = db.prepare(`
      SELECT 
        id, pc_id as pcId, pc_name as pcName, user_name as userName,
        connected_at as connectedAt, disconnected_at as disconnectedAt,
        session_duration as sessionDuration, allocated_duration as allocatedDuration,
        status, desk_id as deskId
      FROM pc_sessions
      WHERE id = ?
    `);

    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return this.mapRowToSession(row);
  }

  /**
   * Get all sessions with optional filtering and pagination
   */
  static getSessions(filter: SessionFilter = {}): SessionLog[] {
    let query = `
      SELECT 
        id, pc_id as pcId, pc_name as pcName, user_name as userName,
        connected_at as connectedAt, disconnected_at as disconnectedAt,
        session_duration as sessionDuration, allocated_duration as allocatedDuration,
        status, desk_id as deskId
      FROM pc_sessions
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filter.pcId) {
      query += ' AND pc_id = ?';
      params.push(filter.pcId);
    }

    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.startDate) {
      query += ' AND connected_at >= ?';
      params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query += ' AND connected_at <= ?';
      params.push(filter.endDate.toISOString());
    }

    query += ' ORDER BY connected_at DESC';

    if (filter.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter.offset) {
      query += ' OFFSET ?';
      params.push(filter.offset);
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Get sessions for a specific PC
   */
  static getSessionsByPcId(pcId: string, limit: number = 100, offset: number = 0): SessionLog[] {
    return this.getSessions({ pcId, limit, offset });
  }

  /**
   * Get active sessions
   */
  static getActiveSessions(): SessionLog[] {
    return this.getSessions({ status: 'active' });
  }

  /**
   * Get completed sessions within a date range
   */
  static getCompletedSessions(startDate?: Date, endDate?: Date, limit: number = 100, offset: number = 0): SessionLog[] {
    return this.getSessions({
      status: 'completed',
      startDate,
      endDate,
      limit,
      offset,
    });
  }

  /**
   * Get session statistics
   */
  static getSessionStats(pcId?: string): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    terminatedSessions: number;
    totalDuration: number;
    averageDuration: number;
  } {
    let query = 'FROM pc_sessions WHERE 1=1';
    const params: any[] = [];

    if (pcId) {
      query += ' AND pc_id = ?';
      params.push(pcId);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count ${query}`);
    const countResult = countStmt.get(...params) as any;
    const totalSessions = countResult.count;

    const activeStmt = db.prepare(`SELECT COUNT(*) as count ${query} AND status = 'active'`);
    const activeResult = activeStmt.get(...params) as any;
    const activeSessions = activeResult.count;

    const completedStmt = db.prepare(`SELECT COUNT(*) as count ${query} AND status = 'completed'`);
    const completedResult = completedStmt.get(...params) as any;
    const completedSessions = completedResult.count;

    const terminatedStmt = db.prepare(`SELECT COUNT(*) as count ${query} AND status = 'terminated'`);
    const terminatedResult = terminatedStmt.get(...params) as any;
    const terminatedSessions = terminatedResult.count;

    const durationStmt = db.prepare(`SELECT SUM(session_duration) as total, AVG(session_duration) as avg ${query} AND status = 'completed'`);
    const durationResult = durationStmt.get(...params) as any;
    const totalDuration = durationResult.total || 0;
    const averageDuration = durationResult.avg || 0;

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      terminatedSessions,
      totalDuration,
      averageDuration,
    };
  }

  /**
   * Delete a session (for cleanup purposes)
   */
  static deleteSession(sessionId: string): boolean {
    const stmt = db.prepare('DELETE FROM pc_sessions WHERE id = ?');
    const result = stmt.run(sessionId);
    return (result.changes ?? 0) > 0;
  }

  /**
   * End a session (mark as completed and update duration)
   */
  static endSession(sessionId: string, duration: number): SessionLog | null {
    return this.updateSession(sessionId, {
      status: 'completed',
      disconnectedAt: new Date(),
      sessionDuration: duration,
    });
  }

  /**
   * Terminate a session (mark as terminated)
   */
  static terminateSession(sessionId: string, duration?: number): SessionLog | null {
    return this.updateSession(sessionId, {
      status: 'terminated',
      disconnectedAt: new Date(),
      sessionDuration: duration || 0,
    });
  }

  /**
   * Log a session event (for audit trail)
   */
  static logSessionEvent(sessionId: string, eventType: string, eventData?: any): void {
    const stmt = db.prepare(`
      INSERT INTO session_events (session_id, event_type, event_data)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, eventType, eventData ? JSON.stringify(eventData) : null);
  }

  /**
   * Get session events
   */
  static getSessionEvents(sessionId: string): any[] {
    const stmt = db.prepare(`
      SELECT id, session_id as sessionId, event_type as eventType, 
             event_data as eventData, timestamp
      FROM session_events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(sessionId) as any[];
  }

  /**
   * Helper function to map database row to SessionLog object
   */
  private static mapRowToSession(row: any): SessionLog {
    return {
      id: row.id,
      pcId: row.pcId,
      pcName: row.pcName,
      userName: row.userName,
      connectedAt: new Date(row.connectedAt),
      disconnectedAt: row.disconnectedAt ? new Date(row.disconnectedAt) : undefined,
      sessionDuration: row.sessionDuration,
      allocatedDuration: row.allocatedDuration,
      status: row.status,
      deskId: row.deskId,
    };
  }
}
