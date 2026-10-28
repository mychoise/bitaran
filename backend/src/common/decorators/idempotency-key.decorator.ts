import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { errorBody } from '../filters/all-exceptions.filter.js';

/** Client-chosen per attempt, so a retried request is recognised. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,100}$/;

/** The required Idempotency-Key header, validated. */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const key = ctx
      .switchToHttp()
      .getRequest<Request>()
      .header('idempotency-key');
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestException(
        errorBody(
          'IDEMPOTENCY_KEY_REQUIRED',
          'Send an Idempotency-Key header of 8-100 letters, digits or _.:-',
        ),
      );
    }
    return key;
  },
);
