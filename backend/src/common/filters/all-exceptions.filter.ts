import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DomainException,
  OrderTransitionException,
  InsufficientStockException,
} from '../errors/domain.exceptions';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        message =
          Array.isArray(resp['message'])
            ? (resp['message'] as string[]).join('; ')
            : String(resp['message'] ?? message);
      }
      code = HttpStatus[status] ?? 'HTTP_ERROR';
    } else if (exception instanceof OrderTransitionException) {
      status = HttpStatus.CONFLICT;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof InsufficientStockException) {
      status = HttpStatus.BAD_REQUEST;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof DomainException) {
      status = HttpStatus.BAD_REQUEST;
      code = exception.code;
      message = exception.message;
    } else if (
      exception &&
      typeof (exception as any).status === 'number' &&
      (exception as any).status >= 400 &&
      (exception as any).status < 600
    ) {
      const err = exception as any;
      status = err.status;
      code = err.type || HttpStatus[status] || 'REQUEST_ERROR';
      message = err.message || 'Request failed';
    } else if (exception instanceof Error) {
      // Log unexpected errors
      this.logger.error('Unhandled error', exception.stack);
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message || message;
      }
    }

    const body: ErrorResponse = {
      error: { code, message },
    };

    response.status(status).json(body);
  }
}
