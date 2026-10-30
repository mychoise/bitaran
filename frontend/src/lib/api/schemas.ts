// Input checks shared by the forms and the mock, so a screen and the "server" refuse the same
// things with the same words. The backend must check the same (see docs/api-contract.md).

import { z } from "zod";
import { TEMP_PASSWORD_MIN } from "./mock/rules.ts";

const text = (what: string, max: number) =>
  z.string().trim().min(1, `Enter the ${what}.`).max(max, `Keep the ${what} under ${max} characters.`);

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address, like name@example.com."));
export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{6,18}[0-9]$/, "Enter a phone number using digits, like 9800000000.");

export const temporaryPasswordField = z
  .string()
  .min(TEMP_PASSWORD_MIN, `Use at least ${TEMP_PASSWORD_MIN} characters.`)
  .max(200, "Use 200 characters or fewer.");

const staffRole = z.enum(["manager", "salesman"], "Choose a role.");

export const staffSchema = z.object({
  fullName: text("full name", 100),
  role: staffRole,
  email: emailField,
  phone: phoneField,
});
export const staffCreateSchema = staffSchema.extend({ temporaryPassword: temporaryPasswordField });
export const staffUpdateSchema = staffSchema.partial().extend({ active: z.boolean().optional() });

export const businessSchema = z.object({
  name: text("business name", 120),
  phone: phoneField,
  email: emailField,
  address: text("address", 200),
  city: text("city", 80),
  registrationNo: z.string().trim().max(50, "Keep the registration number under 50 characters."),
});

/** The first problem, in words a person can act on. */
export const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? "Check the form and try again.";
