<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui';

async function updateSystem() {
  if (!window.$message) return;
  const msg = window.$message.loading('正在更新系统...', { duration: 0 });
  try {
    const res = await fetch('/api/system/update', { method: 'POST' });
    const json = await res.json();
    msg?.destroy();
    if (json.code === '0000') {
      window.$message?.success('更新成功，3秒后自动刷新');
      setTimeout(() => location.reload(), 3000);
    } else {
      window.$message?.error(json.msg || '更新失败');
    }
  } catch {
    msg?.destroy();
    window.$message?.error('更新请求失败');
  }
}
</script>

<template>
  <div class="global-update-wrap">
    <div class="version-tag">终焉 | Omega v1.0.5</div>
    <NTooltip placement="right">
      <template #trigger>
        <div class="global-update-btn" @click="updateSystem">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8m0 0h-7m7 0v7"/></svg>
        </div>
      </template>
      检查并更新系统
    </NTooltip>
  </div>
</template>

<style scoped>
.global-update-wrap {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.version-tag {
  font-size: 10px;
  color: var(--n-text-color-3);
  background: rgba(128,128,128,.08);
  border: 1px solid rgba(128,128,128,.16);
  border-radius: 10px;
  padding: 2px 10px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.global-update-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(102,126,234,.35);
  transition: all .25s;
}
.global-update-btn:hover {
  box-shadow: 0 4px 16px rgba(102,126,234,.5);
  transform: translateY(-1px) scale(1.05);
}
.global-update-btn:active {
  transform: translateY(0) scale(1);
}
</style>
