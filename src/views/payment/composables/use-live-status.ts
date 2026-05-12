import { ref, onMounted, onUnmounted } from 'vue';

const customerCount = ref(0);
const operatorCount = ref(0);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setInterval> | null = null;

function connect() {
  try {
    ws = new WebSocket('ws://localhost:9528?role=operator&operatorId=global_header&countable=1');
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'connect_count') {
          customerCount.value = m.payload?.customerCount ?? 0;
          operatorCount.value = m.payload?.operatorCount ?? 0;
        }
      } catch {}
    };
    ws.onclose = () => {
      ws = null;
      reconnectTimer = setInterval(() => { if (!ws) connect(); }, 5000);
    };
    ws.onerror = () => ws?.close();
  } catch {}
}

if (typeof window !== 'undefined') {
  connect();
}

onMounted(() => { if (!ws) connect(); });
onUnmounted(() => {
  if (reconnectTimer) clearInterval(reconnectTimer);
  ws?.close();
});

export function useLiveStatus() {
  return { customerCount, operatorCount };
}
