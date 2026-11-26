import mqtt, { MqttClient } from 'mqtt';
import { BandSession, SyncStatus } from '../types/safestep';

const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const TOPIC_PREFIX = 'safestep/v5/band/';
const BROADCAST_CHANNEL_NAME = 'safestep_v5_sync_channel';

interface WireEnvelope {
  originId: string;
  session: BandSession;
}

type BandListener = (session: BandSession) => void;
type StatusListener = (status: SyncStatus) => void;

class SafeStepSyncEngine {
  private clients: MqttClient[] = [];
  private connectedCount = 0;
  private status: SyncStatus = 'connecting';
  private subscribedBands = new Set<string>();
  private bandListeners = new Map<string, Set<BandListener>>();
  private globalListeners = new Set<BandListener>();
  private statusListeners = new Set<StatusListener>();
  private lastSeenUpdatedAt = new Map<string, number>();
  private channel: BroadcastChannel | null = null;
  private initialized = false;
  private readonly originId = `node_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Same-browser BroadcastChannel for instant zero-latency local tab sync
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<WireEnvelope>) => {
          this.handleIncomingEnvelope(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    // 2. Dual-broker MQTT over WebSockets for real cross-device Laptop <-> Smartphone sync
    BROKER_URLS.forEach((url, idx) => {
      try {
        const clientId = `safestep_${idx}_${Math.random().toString(16).slice(2, 10)}`;
        const client = mqtt.connect(url, {
          clientId,
          clean: true,
          keepalive: 15,
          reconnectPeriod: 1500,
          connectTimeout: 8000,
        });

        client.on('connect', () => {
          this.connectedCount += 1;
          this.updateStatus('connected');
          // Subscribe to all requested band topics
          this.subscribedBands.forEach((bandId) => {
            client.subscribe(`${TOPIC_PREFIX}${bandId}`, { qos: 1 });
          });
        });

        client.on('reconnect', () => {
          if (this.connectedCount === 0) {
            this.updateStatus('reconnecting');
          }
        });

        client.on('offline', () => {
          this.connectedCount = Math.max(0, this.connectedCount - 1);
          if (this.connectedCount === 0) {
            this.updateStatus('reconnecting');
          }
        });

        client.on('close', () => {
          this.connectedCount = Math.max(0, this.connectedCount - 1);
          if (this.connectedCount === 0) {
            this.updateStatus('reconnecting');
          }
        });

        client.on('error', () => {
          // Handled silently via dual-broker fallback & automatic reconnect
        });

        client.on('message', (_topic: string, payload: Uint8Array) => {
          try {
            const text = new TextDecoder().decode(payload);
            const parsed = JSON.parse(text) as WireEnvelope | BandSession;
            if ('session' in parsed && parsed.session && parsed.session.bandId) {
              this.handleIncomingEnvelope(parsed as WireEnvelope);
            } else if ('bandId' in parsed && parsed.bandId) {
              this.handleIncomingEnvelope({
                originId: 'external',
                session: parsed as BandSession,
              });
            }
          } catch {
            // Ignore malformed messages
          }
        });

        this.clients.push(client);
      } catch {
        // Ignore single broker initialization failure
      }
    });
  }

  private updateStatus(next: SyncStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public onStatusChange(cb: StatusListener): () => void {
    this.init();
    this.statusListeners.add(cb);
    cb(this.status);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private handleIncomingEnvelope(envelope: WireEnvelope): void {
    if (!envelope || !envelope.session || !envelope.session.bandId) return;
    // Ignore our own broadcasts to prevent echo loops
    if (envelope.originId === this.originId) return;

    const session = envelope.session;
    const prevTs = this.lastSeenUpdatedAt.get(session.bandId) ?? 0;
    if (session.updatedAt < prevTs) return;
    this.lastSeenUpdatedAt.set(session.bandId, session.updatedAt);

    const specific = this.bandListeners.get(session.bandId);
    if (specific) {
      specific.forEach((cb) => cb(session));
    }
    this.globalListeners.forEach((cb) => cb(session));
  }

  public subscribeBand(bandId: string, cb: BandListener): () => void {
    this.init();
    const isNewTopic = !this.subscribedBands.has(bandId);
    this.subscribedBands.add(bandId);

    if (!this.bandListeners.has(bandId)) {
      this.bandListeners.set(bandId, new Set());
    }
    this.bandListeners.get(bandId)!.add(cb);

    if (isNewTopic) {
      const topic = `${TOPIC_PREFIX}${bandId}`;
      this.clients.forEach((c) => {
        if (c.connected) {
          c.subscribe(topic, { qos: 1 });
        }
      });
    }

    return () => {
      const set = this.bandListeners.get(bandId);
      if (set) {
        set.delete(cb);
        if (set.size === 0) {
          this.bandListeners.delete(bandId);
          this.subscribedBands.delete(bandId);
          const topic = `${TOPIC_PREFIX}${bandId}`;
          this.clients.forEach((c) => {
            if (c.connected) {
              c.unsubscribe(topic);
            }
          });
        }
      }
    };
  }

  public subscribeAll(cb: BandListener): () => void {
    this.init();
    this.globalListeners.add(cb);
    return () => {
      this.globalListeners.delete(cb);
    };
  }

  public publishBand(session: BandSession): void {
    this.init();
    this.lastSeenUpdatedAt.set(session.bandId, session.updatedAt);

    const envelope: WireEnvelope = {
      originId: this.originId,
      session,
    };

    // Broadcast locally across same-browser tabs immediately
    if (this.channel) {
      try {
        this.channel.postMessage(envelope);
      } catch {
        // ignore
      }
    }

    // Publish retained QoS 1 snapshot to both MQTT WebSocket brokers
    const topic = `${TOPIC_PREFIX}${session.bandId}`;
    const payload = JSON.stringify(envelope);

    this.clients.forEach((client) => {
      if (client.connected) {
        client.publish(topic, payload, { qos: 1, retain: true });
      }
    });
  }
}

export const syncEngine = new SafeStepSyncEngine();
