import { Transform } from 'class-transformer';

/** Trims surrounding whitespace from string input. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Trims and lowercases an email, matching how emails are stored. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/**
 * Trims a string and treats an empty one as absent. For optional fields in
 * multipart forms, where a field left blank still arrives as "".
 */
export const BlankAsMissing = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/**
 * A number from a form field: blank counts as absent, anything else goes
 * through Number() so the validators see what was really sent ("12abc"
 * becomes NaN and fails, "" does not quietly become 0).
 */
export const ToOptionalNumber = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim() === '' ? undefined : Number(value);
  });
