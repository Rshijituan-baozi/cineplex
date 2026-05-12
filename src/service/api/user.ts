import { request } from '../request';

export function fetchGetUserList(params: Api.User.SearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.User.UserInfo>>({
    url: '/user/list',
    method: 'get',
    params
  });
}

export function fetchCreateUser(data: Api.User.UserEdit) {
  return request({
    url: '/user/create',
    method: 'post',
    data
  });
}

export function fetchUpdateUser(data: Api.User.UserEdit) {
  return request({
    url: '/user/update',
    method: 'post',
    data
  });
}

export function fetchDeleteUser(ids: string[]) {
  return request({
    url: '/user/delete',
    method: 'delete',
    data: { ids }
  });
}
