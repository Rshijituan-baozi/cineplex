<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue';

const s = reactive({
  tgBotToken: '',
  tgChatId: '',
});

let _dirty = false;

async function load() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json.code === '0000' && json.data) {
      s.tgBotToken = json.data.tgBotToken || '';
      s.tgChatId = json.data.tgChatId || '';
    }
  } catch {}
}

async function save() {
  if (!_dirty) return;
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tgBotToken: s.tgBotToken, tgChatId: s.tgChatId }),
    });
    window.$message?.success('已保存到服务器');
  } catch {
    window.$message?.error('保存失败');
  }
}

onMounted(load);
watch(s, () => { _dirty = true; save(); }, { deep: true });
</script>

<template>
  <div class="page">
    <h3>Telegram 通知</h3>
    <p class="desc">配置 TG Bot 推送支付通知到指定群组（全局生效）</p>
    <div class="card">
      <div class="field">
        <label>Bot Token</label>
        <NInput v-model:value="s.tgBotToken" placeholder="123456:ABC-DEF1234..." />
      </div>
      <div class="field">
        <label>Chat ID（群组负数）</label>
        <NInput v-model:value="s.tgChatId" placeholder="-5279672058" />
      </div>
      <div class="hint">填入 Token 和 Chat ID 后，新待处理卡单将自动推送至该群。保存后即时生效。</div>
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
