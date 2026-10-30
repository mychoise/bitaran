// Input checks shared by the forms and the mock, so a screen and the "server" refuse the same
// things with the same words. The backend must check the same (see docs/api-contract.md).

import { z } from "zod";
import { checkCarton, TEMP_PASSWORD_MIN } from "./mock/rules.ts";

export const requiredText = (what: string, max: number) =>
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
  fullName: requiredText("full name", 100),
  role: staffRole,
  email: emailField,
  phone: phoneField,
});
export const staffCreateSchema = staffSchema.extend({ temporaryPassword: temporaryPasswordField });
export const staffUpdateSchema = staffSchema.partial().extend({ active: z.boolean().optional() });

export const businessSchema = z.object({
  name: requiredText("business name", 120),
  phone: phoneField,
  email: emailField,
  address: requiredText("address", 200),
  city: requiredText("city", 80),
  registrationNo: z.string().trim().max(50, "Keep the registration number under 50 characters."),
});

export const categoryNameField = requiredText("category name", 60);

const paisa = (what: string) => z.number(`Enter the ${what}.`).int(`Enter the ${what} in rupees and paisa.`).min(0, `The ${what} cannot be below zero.`);
const wholeUnits = (what: string) => z.number(`Enter the ${what}.`).int(`The ${what} must be a whole number.`).min(0, `The ${what} cannot be below zero.`);

export const skuField = z
  .string()
  .trim()
  .min(1, "Enter the SKU.")
  .max(40, "Keep the SKU under 40 characters.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Use letters, numbers, dots, dashes or slashes, with no spaces.");

const productFields = z.object({
  name: requiredText("product name", 120),
  sku: skuField,
  categoryId: z.string().min(1, "Choose a category."),
  unitName: requiredText("unit", 30),
  unitPricePaisa: paisa("price"),
  unitsPerCarton: z.number().int("Units per carton must be a whole number above zero.").positive("Units per carton must be a whole number above zero.").nullable(),
  cartonPricePaisa: paisa("carton price").nullable(),
  costPricePaisa: paisa("cost price"),
  lowStockUnits: wholeUnits("low-stock level"),
  active: z.boolean(),
  imageId: z.string().nullable().optional(),
});

/** The carton rule, checked on the whole product (after a partial update is merged). */
export const withCartonRule = <T extends z.ZodType<{ unitsPerCarton: number | null; cartonPricePaisa: number | null }>>(schema: T) =>
  schema.superRefine((p, ctx) => {
    const problem = checkCarton(p);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: [problem.startsWith("Units") || problem.startsWith("Set units") ? "unitsPerCarton" : "cartonPricePaisa"] });
  });

export const productCreateSchema = withCartonRule(productFields.extend({ stockUnits: wholeUnits("opening stock") }));
export const productUpdateSchema = productFields.partial();
/** A whole product, used to check the result of an update. */
export const productSchema = withCartonRule(productFields);

/** The first problem, in words a person can act on. */
export const firstIssue = (err: z.ZodError) => err.issues[0]?.message ?? "Check the form and try again.";
