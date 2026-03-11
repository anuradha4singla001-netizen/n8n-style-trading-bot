import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { updateTicker, setBots, addLogEntry } = useStore();

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket('ws://localhost:3002');
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            switch (msg.type) {
              case 'tick': updateTicker(msg.payload.pair, msg.payload.price); break;
              case 'bot_status': if (Array.isArray(msg.payload)) setBots(msg.payload); break;
              case 'signal':
                if (msg.payload?.signal?.signal !== 'HOLD') {
                  addLogEntry({ id: Date.now(), time: new Date().toLocaleTimeString('en',{hour12:false}),
                    node: msg.payload?.signal?.reason ?? 'Signal', type: 'signal',
                    pass: msg.payload?.signal?.signal === 'BUY' });
                }
                break;
              case 'order':
                addLogEntry({ id: Date.now(), time: new Date().toLocaleTimeString('en',{hour12:false}),
                  node: `Order: ${msg.payload?.order?.side} ${msg.payload?.order?.pair}`,
                  type: 'action', pass: true });
                break;
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch { setTimeout(connect, 3000); }
    };
    connect();
    return () => { wsRef.current?.close(); };
  }, []);
}
