#!/usr/bin/env node

/**
 * Copy static assets to Next.js standalone output directory
 * 
 * This script copies:
 * 1. .next/static -> .next/standalone/.next/static
 * 2. public -> .next/standalone/public
 * 
 * Required for Next.js standalone mode to serve static assets correctly.
 */

const fs = require('fs');
const path = require('path');

// Get the project root directory (where package.json is located)
const projectRoot = path.resolve(__dirname, '..');

// Source and destination paths
const sources = [
  {
    from: path.join(projectRoot, '.next', 'static'),
    to: path.join(projectRoot, '.next', 'standalone', '.next', 'static'),
    name: '.next/static'
  },
  {
    from: path.join(projectRoot, 'public'),
    to: path.join(projectRoot, '.next', 'standalone', 'public'),
    name: 'public'
  }
];

/**
 * Recursively copy directory
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 * @param {string} name - Human-readable name for logging
 */
function copyDirectory(src, dest, name) {
  try {
    // Check if source exists
    if (!fs.existsSync(src)) {
      console.warn(`⚠ Warning: Source directory "${name}" not found at ${src}`);
      console.warn('  This is normal if you haven\'t run "next build" yet or if the build output is empty.');
      return false;
    }

    // Ensure destination parent directory exists
    const destParent = path.dirname(dest);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    // Check if destination exists and remove it for clean copy
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }

    // Copy directory recursively
    fs.cpSync(src, dest, { recursive: true, force: true });
    
    console.log(`✓ Copied ${name} -> ${path.relative(projectRoot, dest)}`);
    return true;
  } catch (error) {
    console.error(`✗ Error copying ${name}:`, error.message);
    return false;
  }
}

// Main execution
console.log('Copying static assets to standalone output...\n');

let allSuccess = true;

for (const { from, to, name } of sources) {
  const success = copyDirectory(from, to, name);
  if (!success && name === '.next/static') {
    // .next/static is critical, so we should warn but continue
    console.warn('  Note: .next/static is required for static assets to work properly.\n');
    allSuccess = false;
  }
}

console.log(''); // Empty line for readability

if (allSuccess) {
  console.log('✓ All static assets copied successfully!');
  process.exit(0);
} else {
  console.warn('⚠ Some assets could not be copied. Check the warnings above.');
  console.warn('  This may cause 404 errors for static assets in production.');
  // Don't exit with error code - allow build to continue
  // Some assets might not exist in all build scenarios
  process.exit(0);
}
