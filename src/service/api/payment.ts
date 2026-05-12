import { paymentRequest } from '../request';

export function fetchPaymentSessions() {
  return paymentRequest<Api.Payment.PaymentSession[]>({
    url: '/payment/sessions'
  });
}
