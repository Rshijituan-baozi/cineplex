<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue';

const s = reactive({ unattendedMode: false, unattendedSeconds: 3, allowDuplicateCard: false });
let _dirty = false;

async function load() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json.code === '0000' && json.data) Object.assign(s, json.data);
  } catch {}
}
async function save() { if (!_dirty) return; _dirty = false; try { await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }) } catch {} }
onMounted(load);
watch(s, () => { _dirty = true; save(); }, { deep: true });
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
