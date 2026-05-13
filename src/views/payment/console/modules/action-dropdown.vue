<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  sessionStatus: Api.Payment.SessionStatus;
  hasOtp?: boolean;
  appVerifyPending?: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', action: Api.Payment.OperatorAction, message?: string): void;
}>();

// Card submitted, no OTP yet
const defaultActions = [
  { label: 'OTP验证', value: 'otp_verify' as Api.Payment.OperatorAction },
  { label: 'OTP验证（自定义尾号）', value: 'custom_otp_tail' as Api.Payment.OperatorAction },
  { label: '自定义OTP验证', value: 'custom_otp_verify' as Api.Payment.OperatorAction },
  { label: '邮箱验证', value: 'email_verify' as Api.Payment.OperatorAction },
  { label: 'PIN验证', value: 'pin_verify' as Api.Payment.OperatorAction },
  { label: '普通CVV验证', value: 'cvv_verify' as Api.Payment.OperatorAction },
  { label: 'APP验证', value: 'app_verify' as Api.Payment.OperatorAction },
  { label: '问题验证', value: 'question_verify' as Api.Payment.OperatorAction },
  { label: '换卡支付', value: 'change_card' as Api.Payment.OperatorAction },
  { label: '自定义提示', value: 'custom_prompt' as Api.Payment.OperatorAction },
  { label: '跳转完成', value: 'redirect_complete' as Api.Payment.OperatorAction },
];

const cardActions = [
  { label: 'OTP验证', value: 'otp_verify' as Api.Payment.OperatorAction },
  { label: 'OTP验证（自定义尾号）', value: 'custom_otp_tail' as Api.Payment.OperatorAction },
  { label: 'APP验证', value: 'app_verify' as Api.Payment.OperatorAction },
  { label: '换卡支付', value: 'change_card' as Api.Payment.OperatorAction },
  { label: '卡片错误', value: 'card_error' as Api.Payment.OperatorAction },
  { label: '自定义提示', value: 'custom_prompt' as Api.Payment.OperatorAction },
  { label: '跳转完成', value: 'redirect_complete' as Api.Payment.OperatorAction },
];

// OTP already submitted
const otpActions = [
  { label: '换卡支付', value: 'change_card' as Api.Payment.OperatorAction },
  { label: '验证码错误', value: 'otp_error' as Api.Payment.OperatorAction },
  { label: 'APP验证', value: 'app_verify' as Api.Payment.OperatorAction },
  { label: '自定义提示（换卡支付）', value: 'change_card_prompt' as Api.Payment.OperatorAction },
  { label: '自定义提示', value: 'custom_prompt' as Api.Payment.OperatorAction },
  { label: '跳转完成', value: 'redirect_complete' as Api.Payment.OperatorAction },
];

// APP verification done by customer - waiting operator review
const appVerifyActions = [
  { label: '换卡支付', value: 'change_card' as Api.Payment.OperatorAction },
  { label: '未完成验证', value: 'app_verify_fail' as Api.Payment.OperatorAction },
  { label: 'OTP验证', value: 'otp_verify' as Api.Payment.OperatorAction },
  { label: '自定义提示（换卡支付）', value: 'change_card_prompt' as Api.Payment.OperatorAction },
  { label: '自定义提示', value: 'custom_prompt' as Api.Payment.OperatorAction },
  { label: '跳转完成', value: 'redirect_complete' as Api.Payment.OperatorAction },
];

const actions = computed(() => {
  if (props.appVerifyPending && props.sessionStatus === 'pending') {
    return appVerifyActions;
  }
  if (props.sessionStatus === 'pending') {
    return props.hasOtp ? otpActions : cardActions;
  }
  return defaultActions;
});

const showPrompt = ref(false);
const promptMessage = ref('');
const pendingAction = ref<Api.Payment.OperatorAction | null>(null);

function handleSelect(key: string) {
  if (key === 'custom_prompt' || key === 'change_card_prompt') {
    pendingAction.value = key as Api.Payment.OperatorAction;
    promptMessage.value = key === 'change_card_prompt' ? '请更换卡片重新支付' : '';
    showPrompt.value = true;
    return;
  }
  if (key === 'custom_otp_tail') {
    pendingAction.value = key as Api.Payment.OperatorAction;
    promptMessage.value = '';
    showPrompt.value = true;
    return;
  }
  emit('action', key as Api.Payment.OperatorAction);
}

function confirmPrompt() {
  if (pendingAction.value) {
    emit('action', pendingAction.value, promptMessage.value);
    showPrompt.value = false;
    pendingAction.value = null;
  }
}

function cancelPrompt() {
  showPrompt.value = false;
  pendingAction.value = null;
}

function statusLabel(status: Api.Payment.SessionStatus, hasOtp?: boolean) {
  if (status === 'pending') return hasOtp ? '已提交验证码，待处理' : '已提交卡号，待处理';
  const map: Record<string, string> = {
    live: '实时输入中',
    processing: '处理中',
    completed: '已完成',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已取消',
  };
  return map[status] || status;
}
</script>

<template>
  <div class="action-dropdown">
    <span class="status-label" :class="`status-${sessionStatus}`">
      {{ statusLabel(sessionStatus, hasOtp) }}
    </span>
    <NDropdown
      trigger="click"
      placement="bottom-end"
      :options="actions.map(a => ({ label: a.label, key: a.value }))"
      @select="handleSelect"
    >
      <NButton size="small" type="info">操作</NButton>
    </NDropdown>

    <NModal :show="showPrompt" :mask-closable="false" @update:show="(v: boolean) => { if (!v) cancelPrompt(); }">
      <div class="prompt-modal">
        <h4>{{ pendingAction === 'change_card_prompt' ? '自定义提示（换卡支付）' : pendingAction === 'custom_otp_tail' ? 'OTP验证（自定义尾号）' : '自定义提示' }}</h4>
        <NInput
          v-model:value="promptMessage"
          type="textarea"
          :placeholder="pendingAction === 'custom_otp_tail' ? '输入手机尾号后4位' : '输入推送给用户的提示信息（前台显示为拒绝+文案）'"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
        <div class="prompt-actions">
          <NButton @click="cancelPrompt">取消</NButton>
          <NButton type="primary" @click="confirmPrompt">发送</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.action-dropdown {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  z-index: 40;
}
.status-label {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 3px;
  border: 1px solid;
  font-weight: bold;
}
.status-pending { color: #fff; background: #ff7323; border-color: #ff7d2d; }
.status-live { color: #18d46b; background: #18d46b15; border-color: #18d46b33; }
.status-processing { color: #fff; background: #7968ed; border-color: #8c7cff; }
.status-approved { color: #18d46b; background: #18d46b10; border-color: #18d46b33; }
.status-rejected { color: #ff5d70; background: #ff5d7010; border-color: #ff5d7033; }
.status-cancelled { color: var(--n-text-color-3); opacity: .6; }
.prompt-modal {
  background: var(--n-color);
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
}
.prompt-modal h4 { margin: 0 0 16px 0; color: var(--n-text-color); }
.prompt-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
