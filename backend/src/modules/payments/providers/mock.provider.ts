import { Injectable } from '@nestjs/common';
import { PaymentProviderInterface } from './payment-provider.interface';

/**
 * Mock payment provider used for both ESEWA and KHALTI in the prototype.
 * Initiate returns a URL to the mock payment page in the web app.
 * Verify always returns success if the gatewayRef matches our pattern.
 */
@Injectable()
export class MockProvider implements PaymentProviderInterface {
  async initiate(input: {
    orderId: string;
    amountPaisa: bigint;
    returnUrl: string;
  }): Promise<{ redirectUrl: string; gatewayRef: string }> {
    // Generate a deterministic fake gateway reference
    const gatewayRef = `MOCK-${input.orderId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    return {
      redirectUrl: `/payment/mock-callback?ref=${gatewayRef}&returnUrl=${encodeURIComponent(input.returnUrl)}`,
      gatewayRef,
    };
  }

  async verify(input: {
    gatewayRef: string;
  }): Promise<{ ok: boolean; amountPaisa: bigint }> {
    // Mock: refs starting with MOCK- and PAID suffix are successful
    const ok = input.gatewayRef.startsWith('MOCK-') && input.gatewayRef.includes('-PAID');
    return { ok, amountPaisa: 0n }; // Amount checked from DB, not gateway
  }
}
