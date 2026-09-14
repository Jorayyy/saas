const { execSync } = require('child_process');
try {
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
} catch (e) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}
