// Variables mínimas para que la validación de entorno no falle en tests.
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.VITEST = "1";
process.env.DATABASE_URL ||= "postgresql://test";
process.env.ADMIN_USERNAME ||= "fotografo";
process.env.ADMIN_PASSWORD ||= "contrasena-larga";
process.env.SESSION_SECRET ||= "session-secret-de-prueba-1234";
process.env.GOOGLE_CLIENT_ID ||= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-client-secret";
process.env.GOOGLE_REFRESH_TOKEN ||= "test-refresh-token";
process.env.IP_HASH_SALT ||= "sal-de-prueba-1234";
process.env.MAX_FILE_SIZE_BYTES ||= "26214400";
process.env.MAX_FILES_PER_BATCH ||= "20";
