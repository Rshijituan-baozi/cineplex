<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useNaiveForm } from '@/hooks/common/form';
import { useFormRules } from '@/hooks/common/form';
import { fetchCreateUser, fetchUpdateUser } from '@/service/api';
import { $t } from '@/locales';

const props = defineProps<{
  visible: boolean;
  operateType: NaiveUI.TableOperateType;
  rowData: Api.User.UserInfo | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void;
  (e: 'success'): void;
}>();

const { formRef, validate, restoreValidation } = useNaiveForm();
const { formRules } = useFormRules();

const model = reactive({
  id: undefined as number | undefined,
  userName: '',
  realName: '',
  email: '',
  phone: '',
  password: '',
  roles: ['R_USER'] as string[],
  status: '1' as Api.Common.EnableStatus
});

const rules: Record<string, App.Global.FormRule | App.Global.FormRule[]> = {
  userName: formRules.userName,
  email: formRules.email,
  phone: formRules.phone,
  password: formRules.pwd
};

watch(() => props.visible, val => {
  if (val) {
    restoreValidation();
    if (props.operateType === 'edit' && props.rowData) {
      model.id = props.rowData.id;
      model.userName = props.rowData.userName;
      model.realName = props.rowData.realName;
      model.email = props.rowData.email;
      model.phone = props.rowData.phone;
      model.roles = props.rowData.roles;
      model.status = props.rowData.status || '1';
      model.password = '';
    } else {
      model.id = undefined;
      model.userName = '';
      model.realName = '';
      model.email = '';
      model.phone = '';
      model.roles = ['R_USER'];
      model.status = '1';
      model.password = '';
    }
  }
});

async function handleSubmit() {
  await validate();
  const api = props.operateType === 'add' ? fetchCreateUser : fetchUpdateUser;
  await api(model as Api.User.UserEdit);
  window.$message?.success(props.operateType === 'add' ? $t('common.addSuccess') : $t('common.updateSuccess'));
  emit('update:visible', false);
  emit('success');
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<template>
  <NDrawer :show="visible" :width="400" @update:show="handleClose">
    <NDrawerContent :title="operateType === 'add' ? $t('common.add') : $t('common.edit')" closable>
      <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" label-width="80">
        <NFormItem :label="$t('page.management.user.userName')" path="userName">
          <NInput v-model:value="model.userName" />
        </NFormItem>
        <NFormItem :label="$t('page.management.user.realName')" path="realName">
          <NInput v-model:value="model.realName" />
        </NFormItem>
        <NFormItem :label="$t('page.management.user.email')" path="email">
          <NInput v-model:value="model.email" />
        </NFormItem>
        <NFormItem :label="$t('page.management.user.phone')" path="phone">
          <NInput v-model:value="model.phone" />
        </NFormItem>
        <NFormItem v-if="operateType === 'add'" :label="$t('page.management.user.password')" path="password">
          <NInput v-model:value="model.password" type="password" />
        </NFormItem>
        <NFormItem :label="$t('page.management.user.roles')" path="roles">
          <NSelect
            v-model:value="model.roles"
            multiple
            :options="[
              { label: '超级管理员', value: 'R_SUPER' },
              { label: '管理员', value: 'R_ADMIN' },
              { label: '普通用户', value: 'R_USER' }
            ]"
          />
        </NFormItem>
        <NFormItem :label="$t('page.management.user.status')" path="status">
          <NRadioGroup v-model:value="model.status">
            <NRadio value="1">{{ $t('page.management.user.enable') }}</NRadio>
            <NRadio value="2">{{ $t('page.management.user.disable') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
      </NForm>

      <template #footer>
        <NSpace>
          <NButton @click="handleClose">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
