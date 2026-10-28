import {
  ArgumentsHost,
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createValidationPipe } from '../validation.js';
import { PaginationQueryDto } from '../dto/pagination.dto.js';
import { AllExceptionsFilter, errorBody } from './all-exceptions.filter.js';

function run(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
}

describe('AllExceptionsFilter', () => {
  it('passes typed business errors through with their stable code', () => {
    const out = run(
      new ConflictException(
        errorBody('SALE_ALREADY_CANCELLED', 'Already cancelled', [{ id: 1 }]),
      ),
    );
    expect(out).toEqual({
      status: 409,
      body: {
        error: {
          code: 'SALE_ALREADY_CANCELLED',
          message: 'Already cancelled',
          details: [{ id: 1 }],
        },
      },
    });
  });

  it('maps plain Nest exceptions from their status', () => {
    expect(run(new NotFoundException('Product not found'))).toEqual({
      status: 404,
      body: {
        error: { code: 'NOT_FOUND', message: 'Product not found', details: [] },
      },
    });
    expect(run(new UnprocessableEntityException()).body.error.code).toBe(
      'UNPROCESSABLE_ENTITY',
    );
  });

  it('hides unknown errors behind a 500 without a stack trace', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const out = run(new Error('db password is hunter2'));
    expect(out).toEqual({
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: [],
        },
      },
    });
    expect(JSON.stringify(out.body)).not.toMatch(/hunter2|at /);
  });

  it('formats validation failures with per-field details', async () => {
    const pipe = createValidationPipe();
    const err = await pipe
      .transform(
        { limit: '500', extra: 'x' },
        { type: 'query', metatype: PaginationQueryDto },
      )
      .catch((e: unknown) => e);
    const out = run(err);
    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('VALIDATION_FAILED');
    expect(out.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'limit' }),
        expect.objectContaining({
          field: 'extra',
          constraints: { whitelistValidation: expect.any(String) },
        }),
      ]),
    );
  });
});
