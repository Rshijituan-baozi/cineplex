<script setup lang="ts">
defineProps<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  liveCount: number;
}>();

const cards: { key: string; label: string; value: number; color: string; icon: string }[] = [];
</script>

<template>
  <div class="overview-cards">
    <div class="stat-card">
      <div class="card-icon" style="background:#18d46b15;color:#18d46b;">📊</div>
      <div class="card-info">
        <span class="card-label">总会话</span>
        <span class="card-value">{{ total }}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="card-icon" style="background:#18d46b15;color:#18d46b;">●</div>
      <div class="card-info">
        <span class="card-label">实时输入中</span>
        <span class="card-value" style="color:#18d46b;">{{ liveCount }}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="card-icon" style="background:#f0a12d15;color:#f0a12d;">🔔</div>
      <div class="card-info">
        <span class="card-label">待处理</span>
        <span class="card-value" style="color:#f0a12d;">{{ pending }}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="card-icon" style="background:#18d46b15;color:#18d46b;">✅</div>
      <div class="card-info">
        <span class="card-label">已通过</span>
        <span class="card-value" style="color:#18d46b;">{{ approved }}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="card-icon" style="background:#ff5d7015;color:#ff5d70;">❌</div>
      <div class="card-info">
        <span class="card-label">已拒绝</span>
        <span class="card-value" style="color:#ff5d70;">{{ rejected }}</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="card-icon" style="background:#7968ed15;color:#7968ed;">📈</div>
      <div class="card-info">
        <span class="card-label">通过率</span>
        <span class="card-value" style="color:#7968ed;">{{ total ? Math.round((approved / (approved + rejected || 1)) * 100) : 0 }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-cards {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 16px 20px;
  min-width: 170px;
  flex: 1;
}
.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card-label {
  font-size: 13px;
  color: var(--n-text-color-3);
}
.card-value {
  font-size: 26px;
  font-weight: bold;
  color: var(--n-text-color);
  line-height: 1;
}
</style>
