import Joi from 'joi';

/** An origin as browsers send it: no path, query or trailing slash. */
const ORIGIN = /^https?:\/\/[^/?#]+$/;
const postgresUrl = Joi.string().uri({ scheme: ['postgres', 'postgresql'] });
const requiredForCloudinary = Joi.string().when('STORAGE_DRIVER', {
  is: 'cloudinary',
  // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional API
  then: Joi.required(),
  otherwise: Joi.optional().allow(''),
});

export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  LOG_LEVEL: string;
  CORS_ORIGINS: string[];
  TRUST_PROXY: boolean | number | string;
  DATABASE_URL: string;
  TEST_DATABASE_URL?: string;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  STORAGE_DRIVER: 'cloudinary' | 'local' | 'memory';
  LOCAL_STORAGE_PATH: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  PHOTO_EXIF_MAX_SKEW_MINUTES: number;
  PHOTO_MAX_DISTANCE_M: number;
}

export const envValidationSchema = Joi.object<Env>({
  // Server
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default((parent: { NODE_ENV?: string }) =>
      parent.NODE_ENV === 'test' ? 'silent' : 'info',
    ),

  // Browser origins allowed to call the API, comma-separated, each exactly
  // scheme://host[:port]. Empty: no cross-origin access (the mobile app does
  // not need CORS).
  CORS_ORIGINS: Joi.array()
    .items(
      Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .pattern(ORIGIN),
    )
    .default([]),
  // Express's 'trust proxy': behind a reverse proxy or load balancer, set it
  // (the number of proxy hops, or their addresses) so client IPs, and with
  // them the per-IP login limit, are real. false: use the socket address.
  TRUST_PROXY: Joi.alternatives(
    Joi.boolean(),
    Joi.number().integer().min(0),
    Joi.string(),
  ).default(false),

  // Database
  DATABASE_URL: postgresUrl.required(),
  TEST_DATABASE_URL: postgresUrl.when('NODE_ENV', {
    is: 'test',
    // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional API
    then: Joi.required().invalid(Joi.ref('DATABASE_URL')).messages({
      'any.invalid': '"TEST_DATABASE_URL" must differ from "DATABASE_URL"',
    }),
    otherwise: Joi.optional(),
  }),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('1d'),

  // Storage
  STORAGE_DRIVER: Joi.string()
    .valid('cloudinary', 'local', 'memory')
    .default('local'),
  LOCAL_STORAGE_PATH: Joi.string().default('./uploads'),

  // Cloudinary: required only when STORAGE_DRIVER=cloudinary
  CLOUDINARY_CLOUD_NAME: requiredForCloudinary,
  CLOUDINARY_API_KEY: requiredForCloudinary,
  CLOUDINARY_API_SECRET: requiredForCloudinary,

  // Visit photos: beyond these a photo is flagged (never rejected).
  PHOTO_EXIF_MAX_SKEW_MINUTES: Joi.number().integer().min(0).default(10),
  PHOTO_MAX_DISTANCE_M: Joi.number().integer().min(0).default(150),
});

/** Validates raw env vars. Throws with every problem listed; the app refuses to start. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const origins = raw.CORS_ORIGINS;
  if (typeof origins === 'string') {
    raw = {
      ...raw,
      CORS_ORIGINS: origins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    };
  }
  const { error, value } = envValidationSchema.validate(raw, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }
  return value;
}
