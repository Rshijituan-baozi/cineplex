<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue';

const s = reactive({ cardTypeFilter: 'off' as 'off' | 'C' | 'D' });
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
    <h3>分流控制</h3>
    <p class="desc">按卡类型自动筛选/拒绝，控制支付流向</p>
    <div class="card">
      <div class="row">
        <span>按卡类型筛选</span>
        <NSelect v-model:value="s.cardTypeFilter" :options="[
          { label: '关闭', value: 'off' },
          { label: '只要 C 卡（信用卡）', value: 'C' },
          { label: '只要 D 卡（借记卡）', value: 'D' },
        ]" size="small" style="width:200px" />
      </div>
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
