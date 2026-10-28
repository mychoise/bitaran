import { pgEnum } from 'drizzle-orm/pg-core';

export const dayPlanStatusEnum = pgEnum('day_plan_status', [
  'planned',
  'in_progress',
  'closed',
  'reconciled',
]);

export const visitStatusEnum = pgEnum('visit_status', [
  'planned',
  'visited',
  'skipped',
]);

export const saleStatusEnum = pgEnum('sale_status', ['confirmed', 'cancelled']);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'cheque',
  'online',
]);

export const expenseTypeEnum = pgEnum('expense_type', [
  'salary',
  'fuel',
  'khaja',
  'miscellaneous',
]);

export const lossReasonEnum = pgEnum('loss_reason', [
  'damaged',
  'expired',
  'other',
]);

export const paymentImageKindEnum = pgEnum('payment_image_kind', [
  'cheque_front',
  'cheque_back',
  'online_screenshot',
  'other',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'confirmed',
  'bounced',
]);

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'manager',
  'salesman',
]);
