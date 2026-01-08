const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Determine if we're in development mode
const dev = process.env.NODE_ENV !== 'production';
// Bind to 0.0.0.0 for Railway (accepts connections from any network interface)
// Railway provides PORT environment variable, so bind to 0.0.0.0 when PORT is set
// Use localhost only for local development when PORT is not set
const hostname = process.env.HOSTNAME || (process.env.PORT ? '0.0.0.0' : 'localhost');
const port = parseInt(process.env.PORT || '3000', 10);

if (!port) {
  console.error('PORT environment variable is required');
  process.exit(1);
}

// Initialize Next.js app (only dev option needed for custom server)
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
