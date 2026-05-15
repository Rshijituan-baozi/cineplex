<script setup lang="ts">
defineProps<{
  stats: { visits: number; turnover: number; blocked: number; deals: number };
}>();
</script>

<template>
  <div class="stats-grid">
    <NCard :bordered="false" size="small">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#ec4786,#b955a4)">📊</div>
        <div>
          <div class="stat-label">访问量</div>
          <div class="stat-value">{{ stats.visits.toLocaleString() }}</div>
        </div>
      </div>
    </NCard>
    <NCard :bordered="false" size="small">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#865ec0,#5144b4)">💰</div>
        <div>
          <div class="stat-label">成交额</div>
          <div class="stat-value">${{ stats.turnover.toLocaleString() }}</div>
        </div>
      </div>
    </NCard>
    <NCard :bordered="false" size="small">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#56cdf3,#719de3)">🛡</div>
        <div>
          <div class="stat-label">拦截量</div>
          <div class="stat-value">{{ stats.blocked.toLocaleString() }}</div>
        </div>
      </div>
    </NCard>
    <NCard :bordered="false" size="small">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#fcbc25,#f68057)">✅</div>
        <div>
          <div class="stat-label">成交量</div>
          <div class="stat-value">{{ stats.deals.toLocaleString() }}</div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 860px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  flex-shrink: 0;
}
.stat-label {
  font-size: 13px;
  color: var(--n-text-color-3);
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  margin-top: 2px;
}
</style>
