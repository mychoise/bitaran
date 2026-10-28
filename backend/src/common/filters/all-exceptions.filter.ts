import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

/**
 * Turns every thrown value into `{ error: { code, message, details } }`.
 * Business-rule exceptions pass a body already in that shape; anything else
 * is mapped from the HTTP status. Unknown errors become a 500 without a stack.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body } = this.toErrorBody(exception);
    if (status >= 500) {
      this.logger.error(
        { err: exception, method: req.method, path: req.url },
        'Unhandled exception',
      );
    }
    res.status(status).json(body);
  }

  private toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
    if (isClientHttpError(exception)) {
      // Raised by Express middleware (body-parser) before Nest's routing.
      const status = exception.status;
      return {
        status,
        body: errorBody(
          HttpStatus[status] ?? 'HTTP_ERROR',
          BODY_PARSER_MESSAGES[exception.type ?? ''] ?? exception.message,
        ),
      };
    }
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: errorBody('INTERNAL_ERROR', 'An unexpected error occurred'),
      };
    }

    const status = exception.getStatus();
    const fallbackCode = HttpStatus[status] ?? 'HTTP_ERROR';
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { status, body: errorBody(fallbackCode, response) };
    }

    const r = response as Record<string, unknown>;
    const err = r['error'];
    if (isErrorShape(err)) {
      return {
        status,
        body: errorBody(
          err.code,
          typeof err.message === 'string' ? err.message : exception.message,
          Array.isArray(err.details) ? err.details : [],
        ),
      };
    }

    // Nest's built-in shape: { statusCode, message: string | string[], error }
    const message = r['message'];
    return {
      status,
      body: errorBody(
        fallbackCode,
        Array.isArray(message)
          ? message.join('; ')
          : typeof message === 'string'
            ? message
            : exception.message,
        Array.isArray(message) ? message : [],
      ),
    };
  }
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.too.large': 'The request body is too large',
  'entity.parse.failed': 'The request body is not valid JSON',
  'encoding.unsupported': 'Unsupported request body encoding',
  'charset.unsupported': 'Unsupported request body charset',
};

/**
 * An `http-errors` error meant for the client: a 4xx status marked safe to
 * show (`expose`), as body-parser raises for bad or oversized bodies.
 */
function isClientHttpError(
  value: unknown,
): value is { status: number; message: string; type?: string } {
  const v = value as { status?: unknown; expose?: unknown } | null;
  return (
    value instanceof Error &&
    v?.expose === true &&
    typeof v.status === 'number' &&
    v.status >= 400 &&
    v.status < 500
  );
}

function isErrorShape(
  value: unknown,
): value is { code: string; message?: unknown; details?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

export function errorBody(
  code: string,
  message: string,
  details: unknown[] = [],
): ErrorBody {
  return { error: { code, message, details } };
}
