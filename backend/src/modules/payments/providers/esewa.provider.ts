import { Injectable } from '@nestjs/common';
import { PaymentProviderInterface } from './payment-provider.interface';

/**
 * eSewa payment provider stub.
 * TODO: Real implementation needs:
 * 1. POST to https://epay.esewa.com.np/api/epay/main/v2/form with HMAC-SHA256 signature
 * 2. Verify callback by checking signed response from eSewa
 * 3. Use merchant code from GatewayAccount.merchantCode
 * 4. Decrypt secret from GatewayAccount.secretEncrypted using AES-GCM
 * See: https://developer.esewa.com.np/
 */
@Injectable()
export class EsewaProvider implements PaymentProviderInterface {
  async initiate(_input: {
    orderId: string;
    amountPaisa: bigint;
    returnUrl: string;
  }): Promise<{ redirectUrl: string; gatewayRef: string }> {
    throw new Error('eSewa real integration not implemented. Use MockProvider for prototype.');
  }

  async verify(_input: {
    gatewayRef: string;
  }): Promise<{ ok: boolean; amountPaisa: bigint }> {
    throw new Error('eSewa real integration not implemented. Use MockProvider for prototype.');
  }
}
