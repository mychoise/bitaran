import { ValidateBy, ValidationOptions } from 'class-validator';
import { isDateOnly } from '../utils/date.util.js';

/** A real calendar date as YYYY-MM-DD. */
export const IsDateOnly = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: isDateOnly,
        defaultMessage: (args) =>
          `${args?.property} must be a valid date as YYYY-MM-DD`,
      },
    },
    options,
  );
