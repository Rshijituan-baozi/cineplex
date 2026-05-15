<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/store/modules/app';
import HeaderBanner from './modules/header-banner.vue';
import StatsCards from './modules/stats-cards.vue';
import AuditLog from './modules/audit-log.vue';
import CreativityBanner from './modules/creativity-banner.vue';

const appStore = useAppStore();
const timeRange = ref(7);

interface StatsData {
  visits: number;
  turnover: number;
  blocked: number;
  deals: number;
}

const stats = ref<StatsData>({ visits: 0, turnover: 0, blocked: 0, deals: 0 });

async function loadStats() {
  try {
    const res = await fetch(`/api/payment/stats?range=${timeRange.value}`);
    const json = await res.json();
    if (json.code === '0000') stats.value = json.data;
  } catch {}
}

const ranges = [
  { label: '今日', value: 1 },
  { label: '3日', value: 3 },
  { label: '7日', value: 7 },
  { label: '30日', value: 30 },
];

function setRange(val: number) {
  timeRange.value = val;
  loadStats();
}

onMounted(() => loadStats());
</script>

<template>
  <NSpace vertical :size="16">
    <HeaderBanner />
    <NCard :bordered="false" class="card-wrapper">
      <div class="stats-header">
        <h3>数据统计</h3>
        <NButtonGroup size="small">
          <NButton
            v-for="r in ranges"
            :key="r.value"
            :type="timeRange === r.value ? 'primary' : 'default'"
            @click="setRange(r.value)"
          >{{ r.label }}</NButton>
        </NButtonGroup>
      </div>
      <StatsCards :stats="stats" />
    </NCard>
    <NGrid :x-gap="appStore.isMobile ? 0 : 16" :y-gap="16" responsive="screen" item-responsive>
      <NGi span="24 s:24 m:14">
        <AuditLog />
      </NGi>
      <NGi span="24 s:24 m:10">
        <CreativityBanner />
      </NGi>
    </NGrid>
  </NSpace>
</template>

<style scoped>
.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.stats-header h3 {
  font-size: 18px;
  font-weight: 700;
}
</style>
