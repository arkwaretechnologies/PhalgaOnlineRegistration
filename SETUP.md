# Setup Instructions

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env.local` file in the root directory with the following content:
   ```
   DB_HOST=localhost
   DB_NAME=PHALGA
   DB_USER=fulzjdjlrc8c
   DB_PASSWORD=Masterkey2024@ph
   ```

   **Important:** Update these values with your actual cPanel MySQL database credentials.

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   
   Open your browser and navigate to: `http://localhost:3000`

## Database Connection

The application connects to a MySQL database. Ensure:
- Your MySQL server is running
- The database `PHALGA` exists
- The user has proper permissions to access the database
- The tables `REGH`, `regd`, and `LGUS` exist with the correct schema

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Troubleshooting

### Database Connection Issues
- Verify your database credentials in `.env.local`
- Check if the MySQL server is accessible
- Ensure the database name, username, and password are correct

### Port Already in Use
- Change the port by modifying the dev script in `package.json`:
  ```json
  "dev": "next dev -p 3001"
  ```

### Module Not Found Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

