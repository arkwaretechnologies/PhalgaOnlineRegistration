// Railway-compatible wrapper for Next.js standalone server
// Ensures the server binds to 0.0.0.0 for Railway's networking requirements

const port = parseInt(process.env.PORT || '3000', 10);

if (!port) {
  console.error('PORT environment variable is required');
  process.exit(1);
}

// Set HOSTNAME to 0.0.0.0 for Railway if not explicitly set
// Next.js standalone server respects HOSTNAME environment variable
if (!process.env.HOSTNAME) {
  process.env.HOSTNAME = '0.0.0.0';
}

// Ensure NODE_ENV is production for Railway
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

console.log(`Starting Next.js standalone server on ${process.env.HOSTNAME}:${port}`);

// Change to the standalone directory and run the server
const path = require('path');
const standaloneDir = path.join(__dirname, '.next', 'standalone');

process.chdir(standaloneDir);

// Execute the standalone server directly
require('./server.js');
