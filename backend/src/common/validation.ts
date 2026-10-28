import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { errorBody } from './filters/all-exceptions.filter.js';

interface FieldError {
  field: string;
  constraints: Record<string, string>;
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, constraints: e.constraints }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Global pipe: strips nothing silently; unknown fields are an error. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException(
        errorBody(
          'VALIDATION_FAILED',
          'Request validation failed',
          flatten(errors),
        ),
      ),
  });
}
