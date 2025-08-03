/**
 * Session management for thread-safe MCP server
 */
import { randomUUID } from 'crypto';
import logger from './utils/logger.js';

export interface SessionState {
  sessionId: string;
  storyPointsFieldRef: { current: string | null };
  configCache: Map<string, any>;
  lastActivity: Date;
  createdAt: Date;
  accessedProjects: Map<string, Set<string>>; // Map<instanceName, Set<projectKey>>
}

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Note: Cleanup interval now starts lazily when first session is created
    // to avoid persistent timers when server is unused
    logger.info('SessionManager initialized', {
      sessionTimeout: this.SESSION_TIMEOUT_MS,
    });
  }

  /**
   * Start cleanup interval if not already running
   */
  private ensureCleanupInterval() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupInactiveSessions();
        // Stop interval if no sessions remain
        if (this.sessions.size === 0) {
          this.stopCleanupInterval();
        }
      }, this.CLEANUP_INTERVAL_MS);
    }
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create a new session with isolated state
   */
  createSession(sessionId?: string): SessionState {
    const id = sessionId || randomUUID();
    const now = new Date();

    const session: SessionState = {
      sessionId: id,
      storyPointsFieldRef: { current: null },
      configCache: new Map(),
      lastActivity: now,
      createdAt: now,
      accessedProjects: new Map(),
    };

    this.sessions.set(id, session);

    // Start cleanup interval now that we have a session
    this.ensureCleanupInterval();

    logger.info('Session created', {
      sessionId: id,
      totalSessions: this.sessions.size,
    });

    return session;
  }

  /**
   * Get an existing session or create a new one
   */
  getOrCreateSession(sessionId?: string): SessionState {
    if (!sessionId) {
      return this.createSession();
    }

    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    return this.createSession(sessionId);
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      return session;
    }
    return null;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Remove a specific session
   */
  removeSession(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId);
    if (removed) {
      logger.info('Session removed', {
        sessionId,
        totalSessions: this.sessions.size,
      });
    }
    return removed;
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceActivity > this.SESSION_TIMEOUT_MS) {
        toRemove.push(sessionId);
      }
    }

    if (toRemove.length > 0) {
      for (const sessionId of toRemove) {
        this.sessions.delete(sessionId);
      }

      logger.info('Cleaned up inactive sessions', {
        removedSessions: toRemove,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session metrics for monitoring
   */
  getMetrics() {
    const now = new Date();
    const sessions = Array.from(this.sessions.values());

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(
        s => now.getTime() - s.lastActivity.getTime() < 5 * 60 * 1000 // Active in last 5 minutes
      ).length,
      oldestSession:
        sessions.length > 0 ? Math.min(...sessions.map(s => s.createdAt.getTime())) : null,
      averageAge:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (now.getTime() - s.createdAt.getTime()), 0) /
            sessions.length
          : 0,
    };
  }

  /**
   * Get all session IDs (for debugging)
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Track that a project has been accessed in this session
   */
  trackProjectAccess(sessionId: string, instanceName: string, projectKey: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Update activity timestamp
    session.lastActivity = new Date();

    // Check if this is the first access to this project in this instance
    if (!session.accessedProjects.has(instanceName)) {
      session.accessedProjects.set(instanceName, new Set());
    }

    const instanceProjects = session.accessedProjects.get(instanceName)!;
    const isFirstAccess = !instanceProjects.has(projectKey);

    if (isFirstAccess) {
      instanceProjects.add(projectKey);
      logger.info('First project access tracked', {
        sessionId,
        instanceName,
        projectKey,
        totalProjectsInInstance: instanceProjects.size,
      });
    }

    return isFirstAccess;
  }

  /**
   * Check if a project has been accessed before in this session
   */
  hasAccessedProject(sessionId: string, instanceName: string, projectKey: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const instanceProjects = session.accessedProjects.get(instanceName);
    return instanceProjects?.has(projectKey) ?? false;
  }

  /**
   * Get all accessed projects for a session
   */
  getAccessedProjects(sessionId: string): Map<string, Set<string>> {
    const session = this.sessions.get(sessionId);
    return session?.accessedProjects ?? new Map();
  }

  /**
   * Destroy the session manager and clean up resources
   */
  destroy(): void {
    this.stopCleanupInterval();

    logger.info('SessionManager destroyed', {
      finalSessionCount: this.sessions.size,
    });

    this.sessions.clear();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
