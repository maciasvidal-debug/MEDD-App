const { execSync } = require('child_process');

try {
  execSync('npm run test -- --run', { stdio: 'inherit' });
  console.log('All tests passed!');
} catch (e) {
  console.error('Tests failed');
}
