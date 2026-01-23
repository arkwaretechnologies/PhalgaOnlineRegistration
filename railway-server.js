// Railway-compatible wrapper for Next.js standalone server
// Ensures the server binds to 0.0.0.0 for Railway's networking requirements

// CRITICAL: Force HOSTNAME to 0.0.0.0 FIRST, before any other code runs
// Railway sets HOSTNAME to container hostname, but we need 0.0.0.0 for external connections
// Delete existing HOSTNAME if set, then force it to 0.0.0.0
if (process.env.HOSTNAME) {
  delete process.env.HOSTNAME;
}
process.env.HOSTNAME = '0.0.0.0';

const port = parseInt(process.env.PORT || '3000', 10);

if (!port) {
  console.error('PORT environment variable is required');
  process.exit(1);
}

// Ensure NODE_ENV is production for Railway
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Log the configuration (after setting HOSTNAME)
// console.log(`Starting Next.js standalone server on ${process.env.HOSTNAME}:${port}`);
// console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}, HOSTNAME=${process.env.HOSTNAME}, PORT=${port}`);

// Change to the standalone directory and run the server
const path = require('path');
const standaloneDir = path.join(__dirname, '.next', 'standalone');

// Check if standalone directory exists
const fs = require('fs');
if (!fs.existsSync(standaloneDir)) {
  console.error(`Standalone directory not found at ${standaloneDir}`);
  console.error('Please run "npm run build" first to generate the standalone server');
  process.exit(1);
}

const serverPath = path.join(standaloneDir, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error(`Standalone server not found at ${serverPath}`);
  console.error('Please run "npm run build" first to generate the standalone server');
  process.exit(1);
}

// Ensure HOSTNAME is set again right before requiring the server
// (in case it was changed after our initial setting)
process.env.HOSTNAME = '0.0.0.0';

// Change to standalone directory (required for relative imports in standalone build)
process.chdir(standaloneDir);

// Execute the standalone server directly
// The standalone server will use process.env.HOSTNAME and process.env.PORT
require('./server.js');
