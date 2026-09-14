const { execSync } = require('child_process');

console.log('Running database push...');
try {
  execSync('npx prisma db push --force-reset --accept-data-loss', { stdio: 'inherit' });
} catch (e) {
  console.error('Database push failed:', e.message);
  process.exit(1);
}

console.log('Starting API server...');
try {
  execSync('node dist/main.js', { stdio: 'inherit' });
} catch (e) {
  console.error('Server failed to start:', e.message);
  process.exit(1);
}
