<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tabs: Api.Payment.BrowsingTab[];
  currentStep: string;
}>();

const emit = defineEmits<{
  (e: 'hoverTab', label: string, event: MouseEvent): void;
}>();

const stepLabelMap: Record<string, string> = {
  product: '在商品页',
  address: '在地址页',
  card: '在填卡页',
  otp: '在OTP验证页',
  app_verify: '在APP验证页',
  email_verify: '在邮箱验证页',
  pin_verify: '在PIN验证页',
  completed: '已完成'
};

const stepLabel = computed(() => stepLabelMap[props.currentStep] || '');

const orderedTabs = computed(() => {
  const order: Record<string, number> = { '地址页': 1, '卡片页': 2, '卡片历史': 3 };
  return [...props.tabs].sort((a, b) => (order[a.label] || 99) - (order[b.label] || 99));
});
</script>

<template>
  <div class="session-tabs">
    <span class="step-label">{{ stepLabel }}</span>
    <span class="sep" v-if="orderedTabs.some(t => t.count > 0)">|</span>
    <template v-for="(tab, i) in orderedTabs" :key="i">
      <span class="gt" v-if="i > 0 && tab.count > 0 && orderedTabs[i-1]?.count > 0">&gt;</span>
      <span v-if="tab.count > 0"
        class="tab"
        :class="{ active: tab.active }"
        @mouseenter="emit('hoverTab', tab.label, $event)"
      >
        {{ tab.label }}
        <span class="count">({{ tab.count }})</span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.session-tabs {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 10;
  margin-top: 4px;
  margin-left: 22px;
}
.step-label {
  color: #33e07e;
  font-weight: bold;
}
.sep {
  color: #666;
  margin: 0 2px;
  font-size: larger;
}
.tab { color: #a7adc4; cursor: pointer; height: 22px; line-height: 22px; }
.tab:hover {
  color: var(--n-text-color);
}
.sep {
  color: #666;
  margin: 0 2px;
  font-size: larger;
}
.gt {
  color: #666;
}
.tab { color: #a7adc4; cursor: pointer; height: 22px; line-height: 22px; }
.tab:hover { color: var(--n-text-color); }
</style>
