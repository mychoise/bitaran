import { Injectable } from '@nestjs/common';
import { PaymentProviderInterface } from './payment-provider.interface';

/**
 * Khalti payment provider stub.
 * TODO: Real implementation needs:
 * 1. POST to https://a.khalti.com/api/v2/epayment/initiate/ with live secret key
 * 2. Redirect user to Khalti payment URL from response
 * 3. On callback, POST to https://a.khalti.com/api/v2/epayment/lookup/ to verify
 * 4. Use live secret from GatewayAccount.secretEncrypted (AES-GCM decrypted)
 * See: https://docs.khalti.com/
 */
@Injectable()
export class KhaltiProvider implements PaymentProviderInterface {
  async initiate(_input: {
    orderId: string;
    amountPaisa: bigint;
    returnUrl: string;
  }): Promise<{ redirectUrl: string; gatewayRef: string }> {
    throw new Error('Khalti real integration not implemented. Use MockProvider for prototype.');
  }

  async verify(_input: {
    gatewayRef: string;
  }): Promise<{ ok: boolean; amountPaisa: bigint }> {
    throw new Error('Khalti real integration not implemented. Use MockProvider for prototype.');
  }
}
