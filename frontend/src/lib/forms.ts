// Connects zod schemas to react-hook-form without an extra package: the schema's first message
// for each field becomes that field's error.

import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

export function zodResolver<T extends FieldValues>(schema: z.ZodType<T, T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      errors[key] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
