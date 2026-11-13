// Run checks without loading existing service credentials. Prisma/Next may read
// .env files, so pre-populate every declared key before starting the child.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const env = { ...process.env };
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.example']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) env[match[1]] = '';
  }
}
Object.assign(env, {
  DATABASE_URL: 'postgresql://local_check:local_check@127.0.0.1:1/local_check?connect_timeout=1',
  NEXTAUTH_SECRET: 'local-check-only-secret-never-use-in-production',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-check-only',
  NODE_ENV: ['build', 'start'].includes(process.argv[2]) ? 'production' : 'test',
  NEXT_TELEMETRY_DISABLED: '1',
});
const commands = {
  build: ['node_modules/next/dist/bin/next', 'build'],
  security: ['node_modules/ts-node/dist/bin.js', '--compiler-options', '{"module":"commonjs"}', 'scripts/test-security.ts'],
  audit: ['scripts/test-audit.cjs'],
  quote: ['scripts/test-audit.cjs', 'test-quote'],
  start: ['node_modules/next/dist/bin/next', 'start', '-p', '3100'],
  inventory: ['scripts/test-audit.cjs', 'test-inventory'],
  refund: ['scripts/test-audit.cjs', 'test-refund-accounting'],
  checkout: ['scripts/test-audit.cjs', 'test-checkout-auth-security'],
  ordering: ['scripts/test-audit.cjs', 'test-ordering-system'],
  readiness: ['scripts/test-audit.cjs', 'test-razorpay-production-readiness'],
};
if (process.argv[2] === 'all') {
  for (const name of ['security', 'audit', 'quote', 'inventory', 'refund', 'checkout', 'ordering', 'readiness']) {
    const result = spawnSync(process.execPath, commands[name], { env, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  process.exit(0);
}
const args = commands[process.argv[2]];
if (!args) throw new Error('Choose build, security, or audit');
const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
