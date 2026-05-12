<script setup lang="ts">
import { reactive, ref, h } from 'vue';
import { useNaivePaginatedTable, useTableOperate, defaultTransform } from '@/hooks/common/table';
import { fetchGetUserList, fetchDeleteUser } from '@/service/api';
import { $t } from '@/locales';
import UserOperateDrawer from './modules/user-operate-drawer.vue';

interface SearchParams {
  userName: string;
  realName: string;
  status: Api.Common.EnableStatus | null;
}

const searchParams = reactive<SearchParams>({
  userName: '',
  realName: '',
  status: null
});

const checkedRowKeys = ref<(string | number)[]>([]);

const apiParams = reactive({ current: 1, size: 10 });

const {
  data,
  loading,
  columns,
  columnChecks,
  pagination,
  getData
} = useNaivePaginatedTable<any, Api.User.UserInfo>({
  api: () => fetchGetUserList({
    ...apiParams,
    ...searchParams
  }) as any,
  transform: defaultTransform,
  onPaginationParamsChange: (params) => {
    apiParams.current = params.page ?? 1;
    apiParams.size = params.pageSize ?? 10;
  },
  columns: () => [
    { type: 'selection', width: 48 },
    { key: 'id', title: 'ID', width: 64 },
    { key: 'userName', title: $t('page.management.user.userName'), width: 120 },
    { key: 'realName', title: $t('page.management.user.realName'), width: 120 },
    { key: 'email', title: $t('page.management.user.email'), width: 180 },
    { key: 'phone', title: $t('page.management.user.phone'), width: 140 },
    {
      key: 'status',
      title: $t('page.management.user.status'),
      width: 100,
      render: (row: Api.User.UserInfo) => {
        const isEnabled = row.status === '1';
        return h('span', { class: isEnabled ? 'text-success' : 'text-error' }, isEnabled ? $t('page.management.user.enable') : $t('page.management.user.disable'));
      }
    },
    { key: 'createTime', title: $t('page.management.user.createTime'), width: 180 },
    {
      key: 'operate',
      title: $t('common.action'),
      width: 140,
      render: (row: Api.User.UserInfo) => h('div', { class: 'flex gap-8px' }, [
        h('a', { class: 'text-primary cursor-pointer', onClick: () => handleEdit(row.id) }, $t('common.edit')),
        h('a', { class: 'text-error cursor-pointer', onClick: () => handleDelete(row.id) }, $t('common.delete'))
      ])
    }
  ]
});

const { drawerVisible, operateType, handleAdd, handleEdit, editingData } = useTableOperate(data, 'id', getData);

async function handleSearch() {
  await getData();
}

function handleReset() {
  Object.assign(searchParams, { userName: '', realName: '', status: null });
  pagination.page = 1;
  getData();
}

async function handleDelete(id: number) {
  window.$dialog?.info({
    title: $t('common.tip'),
    content: $t('common.confirmDelete'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteUser([String(id)]);
      window.$message?.success($t('common.deleteSuccess'));
      await getData();
    }
  });
}

async function handleBatchDelete() {
  if (!checkedRowKeys.value.length) return;
  window.$dialog?.info({
    title: $t('common.tip'),
    content: $t('common.confirmDelete'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteUser(checkedRowKeys.value.map(String));
      checkedRowKeys.value = [];
      window.$message?.success($t('common.deleteSuccess'));
      await getData();
    }
  });
}
</script>

<template>
  <div class="main-content">
    <NCard :bordered="false" class="card-wrapper">
      <NForm :model="searchParams" label-placement="left" label-width="auto">
        <NGrid :cols="4" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem :label="$t('page.management.user.userName')" path="userName">
              <NInput v-model:value="searchParams.userName" :placeholder="$t('page.management.user.userName')" clearable />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('page.management.user.realName')" path="realName">
              <NInput v-model:value="searchParams.realName" :placeholder="$t('page.management.user.realName')" clearable />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('page.management.user.status')" path="status">
              <NSelect
                v-model:value="searchParams.status"
                :placeholder="$t('common.selectAll')"
                clearable
                :options="[
                  { label: $t('page.management.user.enable'), value: '1' },
                  { label: $t('page.management.user.disable'), value: '2' }
                ]"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NSpace align="end" class="h-full">
              <NButton type="primary" @click="handleSearch">
                {{ $t('common.search') }}
              </NButton>
              <NButton @click="handleReset">
                {{ $t('common.reset') }}
              </NButton>
            </NSpace>
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <TableHeaderOperation
      v-model:columns="columnChecks"
      :disabled-delete="!checkedRowKeys.length"
      :loading="loading"
      @add="handleAdd"
      @delete="handleBatchDelete"
      @refresh="getData"
    />

    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :pagination="pagination"
      :row-key="row => row.id"
      striped
      @update:checked-row-keys="checkedRowKeys = $event"
    />

    <UserOperateDrawer
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :row-data="editingData"
      @success="getData"
    />
  </div>
</template>

<style scoped></style>
