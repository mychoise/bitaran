export class DomainException extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

export class OrderTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_ORDER_TRANSITION',
      `Cannot transition order from ${from} to ${to}`,
    );
  }
}

export class InsufficientStockException extends DomainException {
  constructor(variantId: string) {
    super(
      'INSUFFICIENT_STOCK',
      `Insufficient stock for variant ${variantId}`,
    );
  }
}
