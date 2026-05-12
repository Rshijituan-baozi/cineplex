declare namespace Api {
  namespace User {
    /** user info */
    interface UserInfo {
      id: number;
      userName: string;
      realName: string;
      email: string;
      phone: string;
      avatar: string;
      roles: string[];
      status: Api.Common.EnableStatus | null;
      createTime: string;
      updateTime: string;
    }

    /** user search params */
    interface SearchParams extends Api.Common.CommonSearchParams {
      userName?: string;
      realName?: string;
      status?: Api.Common.EnableStatus | null;
    }

    /** user create/edit params */
    interface UserEdit {
      id?: number;
      userName: string;
      realName: string;
      email: string;
      phone: string;
      roles: string[];
      status: Api.Common.EnableStatus;
      password?: string;
    }
  }
}
