type Environment = Record<string, string | undefined>;

function requireString(
  env: Environment,
  key: string,
  defaultValue?: string,
): string {
  const value = env[key] ?? defaultValue;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalNumber(
  env: Environment,
  key: string,
  defaultValue: number,
): number {
  const rawValue = env[key];
  if (!rawValue) return defaultValue;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive number`);
  }
  return value;
}

export function validateEnvironment(env: Environment) {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: optionalNumber(env, 'PORT', 4000),
    API_PREFIX: env.API_PREFIX ?? 'api',
    CORS_ORIGIN: env.CORS_ORIGIN ?? '*',
    MONGO_URI: requireString(
      env,
      'MONGO_URI',
      'mongodb://127.0.0.1:27017/easy-blinds',
    ),
  };
}
