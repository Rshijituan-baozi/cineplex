<script setup lang="ts">
import { reactive, watch } from 'vue';

const s = reactive({
  unattendedMode: false,
  unattendedSeconds: 3,
  allowDuplicateCard: false,
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
    <h3>播报设置</h3>
    <p class="desc">控制通知播放、无人值守等全局行为</p>
    <div class="card">
      <div class="row"><span>无人值守（{{ s.unattendedSeconds }}s 后自动通过）</span><NSwitch v-model:value="s.unattendedMode" /></div>
      <div class="row"><span>允许重复卡号提交</span><NSwitch v-model:value="s.allowDuplicateCard" /></div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 24px; max-width: 560px; }
h3 { font-size: 18px; margin-bottom: 4px; }
.desc { color: var(--n-text-color-3); font-size: 13px; margin-bottom: 20px; }
.card { border: 1px solid var(--n-border-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
</style>
