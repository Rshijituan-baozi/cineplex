<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue';

const s = reactive({ autoRejectBins: '' });
let _dirty = false;

async function load() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (json.code === '0000' && json.data) {
      s.autoRejectBins = Array.isArray(json.data.autoRejectBins) ? json.data.autoRejectBins.join(',') : (json.data.autoRejectBins || '');
    }
  } catch {}
}
async function save() { if (!_dirty) return; _dirty = false; try { await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }) } catch {} }
onMounted(load);
watch(s, () => { _dirty = true; save(); }, { deep: true });
</script>

<template>
  <div class="page">
    <h3>卡头设置</h3>
    <p class="desc">设置自动拒绝的 BIN 卡头黑名单（全局生效，逗号分隔）</p>
    <div class="card">
      <div class="field">
        <label>自动拒绝的卡头（6位BIN，逗号分隔）</label>
        <NInput v-model:value="s.autoRejectBins" placeholder="457362,521300" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
      </div>
      <div class="hint">每当客户提交卡号，匹配的 BIN 将被自动拒绝。留空则不启用。</div>
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
