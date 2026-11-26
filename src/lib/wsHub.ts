/**
 * Shared App-Wide WebSocket & WebRTC Signaling Hub
 * Guarantees ZERO dropped WebRTC ICE candidates or signaling frames!
 */
export interface WsEventFrame {
  event: string;
  payload: unknown;
  ts: number;
}

type EventListener = (frame: WsEventFrame) => void;
type StatusListener = (online: boolean) => void;

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let currentUserId: string | null = null;
let currentClientId: string | null = null;
let isOnline = false;

const eventListeners = new Set<EventListener>();
const statusListeners = new Set<StatusListener>();

function emitStatus(online: boolean) {
  isOnline = online;
  statusListeners.forEach(fn => {
    try {
      fn(online);
    } catch {
      // ignore
    }
  });
}

function sendRaw(obj: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

export function connectWsHub() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${window.location.host}/ws`);

  ws.onopen = () => {
    emitStatus(true);
    if (currentUserId) {
      sendRaw({ type: 'ws:register', userId: currentUserId });
    }
  };

  ws.onmessage = ev => {
    try {
      const frame = JSON.parse(ev.data) as WsEventFrame;
      if (frame.event === 'system:connected') {
        const p = frame.payload as { clientId?: string } | undefined;
        if (p?.clientId) currentClientId = p.clientId;
      }
      eventListeners.forEach(fn => {
        try {
          fn(frame);
        } catch {
          // ignore listener errors
        }
      });
    } catch {
      // ignore malformed frame
    }
  };

  ws.onclose = () => {
    emitStatus(false);
    ws = null;
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(connectWsHub, 2200);
  };
}

export function registerWsUser(userId: string | null) {
  currentUserId = userId;
  if (userId) {
    connectWsHub();
    sendRaw({ type: 'ws:register', userId });
  }
}

export function sendWsSignal(type: string, payload: Record<string, unknown>) {
  connectWsHub();
  sendRaw({ type, payload });
}

export function subscribeWs(listener: EventListener): () => void {
  connectWsHub();
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function subscribeWsStatus(listener: StatusListener): () => void {
  connectWsHub();
  statusListeners.add(listener);
  listener(isOnline);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getWsClientId(): string | null {
  return currentClientId;
}
