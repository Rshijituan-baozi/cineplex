<script setup lang="ts">
defineProps<{
  customerCount: number;
  operatorCount: number;
  connected: boolean;
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();
</script>

<template>
  <div class="live-header">
    <div class="left">
      <span class="status-tag" :class="connected ? 'online' : 'offline'">
        <span class="dot" :class="connected ? 'dot-online' : 'dot-offline'"></span>
        {{ connected ? '已连接' : '断开' }}
      </span>
      <span class="count-tag">前台 Live：{{ customerCount }}</span>
      <span class="count-tag">后台 Live：{{ operatorCount }}</span>
    </div>
    <div class="right">
      <NButton size="small" quaternary @click="$emit('refresh')">⟳ 刷新</NButton>
    </div>
  </div>
</template>

<style scoped>
.live-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid;
}
.status-tag.online {
  color: #18d46b;
  border-color: #18d46b33;
  background: #18d46b10;
}
.status-tag.offline {
  color: #ff5d70;
  border-color: #ff5d7033;
  background: #ff5d7010;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot-online {
  background: #18d46b;
  box-shadow: 0 0 6px #18d46b;
}
.dot-offline {
  background: #ff5d70;
}
.count-tag {
  color: #999;
  font-size: 12px;
}
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
