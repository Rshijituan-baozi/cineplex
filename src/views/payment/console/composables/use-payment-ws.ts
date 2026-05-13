import { ref, onMounted, onUnmounted, watch } from 'vue';

interface UsePaymentWsOptions {
  wsUrl: string;
  operatorId: string;
  onSessionNew?: (session: any) => void;
  onSessionUpdate?: (data: any) => void;
  onSessionRemove?: (sessionId: string) => void;
  onSessionList?: (sessions: any[]) => void;
  onConnectCount?: (count: Api.Payment.ConnectCount) => void;
  onResendOtp?: (data: { sessionId: string; count: number }) => void;
  onAppVerifyDone?: (data: { sessionId: string }) => void;
}

export function usePaymentWs(options: UsePaymentWsOptions) {
  const {
    wsUrl,
    operatorId,
    onSessionNew,
    onSessionUpdate,
    onSessionRemove,
    onSessionList,
    onConnectCount,
    onResendOtp,
    onAppVerifyDone
  } = options;

  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);
  const reconnectTimer = ref<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimer = ref<ReturnType<typeof setInterval> | null>(null);
  let intentionalClose = false;

  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(`${wsUrl}?role=operator&operatorId=${operatorId}&countable=0`);

    socket.onopen = () => {
      connected.value = true;
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      let msg: Api.Payment.WsMessage;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'session_list':
          onSessionList?.(msg.payload);
          break;
        case 'session_new':
          onSessionNew?.(msg.payload);
          break;
        case 'session_update':
          onSessionUpdate?.(msg.payload);
          break;
        case 'session_remove':
          onSessionRemove?.(msg.sessionId || '');
          break;
        case 'connect_count':
          onConnectCount?.(msg.payload);
          break;
        case 'resend_otp':
          onResendOtp?.(msg.payload);
          break;
        case 'app_verify_done':
          onAppVerifyDone?.(msg.payload);
          break;
      }
    };

    socket.onclose = () => {
      connected.value = false;
      ws.value = null;
      if (!intentionalClose) startReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };

    ws.value = socket;
  }

  function disconnect() {
    intentionalClose = true;
    stopHeartbeat();
    stopReconnect();
    ws.value?.close();
    ws.value = null;
    connected.value = false;
  }

  function sendAction(action: Api.Payment.OperatorAction, sessionId: string, message?: string) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'operator_action',
        payload: { action, sessionId, message, operatorId }
      }));
    }
  }

  function startHeartbeat() {
    heartbeatTimer.value = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 15000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value);
      heartbeatTimer.value = null;
    }
  }

  function startReconnect() {
    if (reconnectTimer.value) return;
    reconnectTimer.value = setInterval(() => {
      connect();
      if (connected.value && reconnectTimer.value) {
        clearInterval(reconnectTimer.value);
        reconnectTimer.value = null;
      }
    }, 5000);
  }

  function stopReconnect() {
    if (reconnectTimer.value) {
      clearInterval(reconnectTimer.value);
      reconnectTimer.value = null;
    }
  }

  onMounted(() => connect());
  onUnmounted(() => disconnect());

  return {
    ws,
    connected,
    sendAction,
    disconnect,
    reconnect: connect
  };
}
