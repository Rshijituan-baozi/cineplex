<script setup lang="ts">
import { NButton } from 'naive-ui';

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
    <NButton type="primary" @click="updateSystem" quaternary>
      <template #icon>
        <svg width="15" height="15" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8m0 0h-7m7 0v7"/></svg>
      </template>
      更新系统
    </NButton>
    <div class="version-tag">终焉 | Omega v1.0.5</div>
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
  align-items: flex-start;
  gap: 4px;
}
.global-update-wrap :deep(.n-button) {
  padding: 0 14px;
  height: 34px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,.22);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  border: none;
  transition: all .25s;
}
.global-update-wrap :deep(.n-button:hover) {
  box-shadow: 0 4px 16px rgba(102,126,234,.4);
  transform: translateY(-1px);
}
.global-update-wrap :deep(.n-button:active) {
  transform: translateY(0);
}
.global-update-wrap :deep(.n-button .n-button__icon) {
  color: #fff;
}
.version-tag {
  font-size: 10px;
  color: rgba(128,128,128,.6);
  background: rgba(128,128,128,.06);
  border-radius: 4px;
  padding: 1px 8px;
  letter-spacing: 0.5px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
</style>
