export interface PaymentProviderInterface {
  initiate(input: {
    orderId: string;
    amountPaisa: bigint;
    returnUrl: string;
  }): Promise<{ redirectUrl: string; gatewayRef: string }>;

  verify(input: {
    gatewayRef: string;
  }): Promise<{ ok: boolean; amountPaisa: bigint }>;
}
