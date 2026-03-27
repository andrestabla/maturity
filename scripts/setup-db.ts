import { prepareDatabase } from '../lib/store.js';

async function main() {
  const result = await prepareDatabase();

  console.log(
    `Database ready. Seeded: ${result.seeded ? 'yes' : 'no'}. Courses available: ${result.courses}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Database setup failed: ${message}`);
  process.exitCode = 1;
});
