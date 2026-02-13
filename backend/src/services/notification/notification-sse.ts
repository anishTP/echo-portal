import type { Notification as NotificationResponse } from '@echo-portal/shared';

type SSEWriter = {
  writeSSE: (event: { event: string; data: string; id?: string }) => Promise<void>;
};

/**
 * In-memory pub/sub for SSE notification delivery.
 * Single-server deployment — no Redis needed.
 */
class NotificationSSE {
  private connections = new Map<string, Set<SSEWriter>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  subscribe(userId: string, stream: SSEWriter): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(stream);
  }

  unsubscribe(userId: string, stream: SSEWriter): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(stream);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  async publish(userId: string, notification: NotificationResponse): Promise<void> {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) return;

    const deadConnections: SSEWriter[] = [];

    for (const stream of userConnections) {
      try {
        await stream.writeSSE({
          event: 'notification',
          data: JSON.stringify(notification),
          id: notification.id,
        });
      } catch {
        deadConnections.push(stream);
      }
    }

    // Clean up dead connections
    for (const dead of deadConnections) {
      userConnections.delete(dead);
    }
    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }
  }

  async publishCount(userId: string, count: number): Promise<void> {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) return;

    for (const stream of userConnections) {
      try {
        await stream.writeSSE({
          event: 'count',
          data: JSON.stringify({ count }),
        });
      } catch {
        // Ignore — will be cleaned up on next publish
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [userId, streams] of this.connections) {
        const deadStreams: SSEWriter[] = [];
        for (const stream of streams) {
          try {
            stream.writeSSE({ event: 'heartbeat', data: '{}' }).catch(() => {
              deadStreams.push(stream);
            });
          } catch {
            deadStreams.push(stream);
          }
        }
        for (const dead of deadStreams) {
          streams.delete(dead);
        }
        if (streams.size === 0) {
          this.connections.delete(userId);
        }
      }
    }, 30_000);
  }

  getConnectionCount(): number {
    let total = 0;
    for (const streams of this.connections.values()) {
      total += streams.size;
    }
    return total;
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.connections.clear();
  }
}

export const notificationSSE = new NotificationSSE();
