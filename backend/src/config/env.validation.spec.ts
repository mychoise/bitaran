import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults to a minimal valid config', () => {
    expect(validateEnv(base)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      JWT_EXPIRY: '1d',
      STORAGE_DRIVER: 'local',
      PHOTO_EXIF_MAX_SKEW_MINUTES: 10,
      PHOTO_MAX_DISTANCE_M: 150,
      CORS_ORIGINS: [],
      TRUST_PROXY: false,
    });
  });

  it.each([
    ['1', 1],
    ['true', true],
    ['false', false],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('reads TRUST_PROXY=%s', (raw, parsed) => {
    expect(validateEnv({ ...base, TRUST_PROXY: raw }).TRUST_PROXY).toBe(parsed);
  });

  it('defaults LOG_LEVEL to silent under test', () => {
    expect(
      validateEnv({
        ...base,
        NODE_ENV: 'test',
        TEST_DATABASE_URL: 'postgresql://u:p@localhost/app_test',
      }).LOG_LEVEL,
    ).toBe('silent');
  });

  it.each([
    ['missing DATABASE_URL', { JWT_SECRET: base.JWT_SECRET }, /DATABASE_URL/],
    [
      'non-postgres DATABASE_URL',
      { ...base, DATABASE_URL: 'mysql://x/y' },
      /DATABASE_URL/,
    ],
    ['short JWT_SECRET', { ...base, JWT_SECRET: 'short' }, /JWT_SECRET/],
    [
      'unknown STORAGE_DRIVER',
      { ...base, STORAGE_DRIVER: 's3' },
      /STORAGE_DRIVER/,
    ],
    ['bad PORT', { ...base, PORT: 'abc' }, /PORT/],
    [
      'negative photo distance',
      { ...base, PHOTO_MAX_DISTANCE_M: '-1' },
      /PHOTO_MAX_DISTANCE_M/,
    ],
  ])('rejects %s', (_label, env, pattern) => {
    expect(() => validateEnv(env)).toThrow(pattern);
  });

  it('requires all Cloudinary credentials only when STORAGE_DRIVER=cloudinary', () => {
    expect(() =>
      validateEnv({ ...base, STORAGE_DRIVER: 'cloudinary' }),
    ).toThrow(
      /CLOUDINARY_CLOUD_NAME.*CLOUDINARY_API_KEY.*CLOUDINARY_API_SECRET/,
    );
    expect(() =>
      validateEnv({
        ...base,
        STORAGE_DRIVER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'c',
        CLOUDINARY_API_KEY: 'k',
        CLOUDINARY_API_SECRET: 's',
      }),
    ).not.toThrow();
    expect(() =>
      validateEnv({
        ...base,
        STORAGE_DRIVER: 'memory',
        CLOUDINARY_API_KEY: '',
      }),
    ).not.toThrow();
  });

  it('under test, requires a TEST_DATABASE_URL different from DATABASE_URL', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'test' })).toThrow(
      /TEST_DATABASE_URL/,
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'test',
        TEST_DATABASE_URL: base.DATABASE_URL,
      }),
    ).toThrow(/must differ/);
  });
});
