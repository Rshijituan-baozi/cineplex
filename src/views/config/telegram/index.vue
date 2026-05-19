<script setup lang="ts">
import { reactive, watch } from 'vue';

const s = reactive({
  tgBotToken: '',
  tgChatId: '',
});

const STORAGE_KEY = 'payment_console_settings';
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {}
}
function save() {
  const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  Object.assign(cur, s);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
}
load();
watch(s, save, { deep: true });
</script>

<template>
  <div class="page">
    <h3>Telegram 通知</h3>
    <p class="desc">配置 TG Bot 推送支付通知到指定群组</p>
    <div class="card">
      <div class="field">
        <label>Bot Token</label>
        <NInput v-model:value="s.tgBotToken" placeholder="123456:ABC-DEF1234..." />
      </div>
      <div class="field">
        <label>Chat ID（群组负数）</label>
        <NInput v-model:value="s.tgChatId" placeholder="-5279672058" />
      </div>
      <div class="hint">填入 Token 和 Chat ID 后，新待处理卡单将自动推送至该群。</div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 24px; max-width: 560px; }
h3 { font-size: 18px; margin-bottom: 4px; }
.desc { color: var(--n-text-color-3); font-size: 13px; margin-bottom: 20px; }
.card { border: 1px solid var(--n-border-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.field label { font-size: 13px; color: var(--n-text-color-3); margin-bottom: 6px; display: block; }
.hint { font-size: 12px; color: var(--n-text-color-3); }
</style>
