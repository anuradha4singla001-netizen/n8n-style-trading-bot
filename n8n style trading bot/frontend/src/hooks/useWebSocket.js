/**
 * useWebSocket hook
 * Connects to the backend WS on mount, auto-reconnects on disconnect.
 */

import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

export function useWebSocket() {
  const { connectWS, wsStatus } = useStore();
  const retryRef = useRef(null);

  useEffect(() => {
    connectWS();

    // Auto-reconnect every 5s if disconnected
    retryRef.current = setInterval(() => {
      const status = useStore.getState().wsStatus;
      if (status === "disconnected" || status === "error") {
        console.log("[WS] Reconnecting...");
        connectWS();
      }
    }, 5000);

    return () => {
      clearInterval(retryRef.current);
      const ws = useStore.getState().ws;
      if (ws) ws.close();
    };
  }, []);

  return wsStatus;
}
