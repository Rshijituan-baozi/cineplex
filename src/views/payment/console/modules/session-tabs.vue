<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tabs: Api.Payment.BrowsingTab[];
  currentStep: string;
}>();

const emit = defineEmits<{
  (e: 'hoverTab', label: string): void;
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
</script>

<template>
  <div class="session-tabs">
    <span class="step-label">{{ stepLabel }}</span>
    <span class="sep">|</span>
    <template v-for="(tab, i) in tabs" :key="i">
      <span class="gt" v-if="i > 0">&gt;</span>
      <span
        class="tab"
        :class="{ active: tab.active }"
        @mouseenter="emit('hoverTab', tab.label)"
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
}
.gt {
  color: #666;
}
.tab {
  color: #a7adc4;
  cursor: pointer;
  height: 22px;
  line-height: 22px;
}
.tab:hover {
  color: #fff;
}
.tab { color: #a7adc4; cursor: pointer; height: 22px; line-height: 22px; }
.count {
  color: #9ca4bd;
}
</style>
