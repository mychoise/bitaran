// Runs before each test file's imports (Jest setupFiles), so the config
// module sees these when it loads. Only fills in what is not already set.

/** The browser origin tests treat as allowed. */
export const TEST_CORS_ORIGIN = 'https://admin.asva.test';
process.env.CORS_ORIGINS ??= TEST_CORS_ORIGIN;
