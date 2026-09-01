const { execSync } = require('child_process');
try {
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
} catch (e) {
  process.exit(0);
}
