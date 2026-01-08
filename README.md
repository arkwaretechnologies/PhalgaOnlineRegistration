# PHALGA Online Registration

A Next.js-based online registration system for the 17th Mindanao Geographic Conference.

## Features

- Dynamic registration form with participant management
- Province and LGU selection with auto-population
- Real-time registration status checking
- MySQL database integration
- Responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- MySQL database access (cPanel)
- Database credentials

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with your database credentials:
```
DB_HOST=localhost
DB_NAME=PHALGA
DB_USER=fulzjdjlrc8c
DB_PASSWORD=Masterkey2024@ph
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The application uses the following MySQL tables:

### REGH (Registration Header)
- REGNUM (Primary Key, Auto Increment)
- CONFCODE
- PROVINCE
- LGU
- CONTACTPERSON
- CONTACTNUM
- EMAIL
- REGDATE (date type)

### regd (Registration Details)
- CONFCODE, REGNUM, LINENUM (Composite Primary Key)
- LASTNAME
- FIRSTNAME
- MIDDLEINIT
- DESIGNATION
- BRGY
- LGU
- PROVINCE
- TSHIRTSIZE
- CONTACTNUM
- PRCNUM
- EXPIRYDATE (date type, nullable)
- EMAIL
- (Plus many other fields for internal use)

### LGUS (Local Government Units)
- PSGC (Primary Key)
- LGUNAME
- GEOLEVEL

## Setting Up the Database

### Option 1: Import the Full Database (Recommended)
If you have the `PHALGA.sql` file with all the data:

```bash
mysql -u root -p < PHALGA.sql
```

This will create the database with all tables and data including the complete LGUS list.

### Option 2: Create Empty Database
Use the `database-setup.sql` script to create the structure only:

```bash
mysql -u root -p < database-setup.sql
```

Note: You'll need to populate the LGUS table with data for the LGU dropdown to work.

## API Routes

- `GET /api/check-registration` - Check if registration is open
- `GET /api/get-lgus?province=<province>` - Get LGUs for a province
- `POST /api/submit-registration` - Submit registration form

## Build for Production

```bash
npm run build
npm start
```

## Notes

- Registration closes when the participant count exceeds 20 (check) or 30 (submit)
- T-shirt sizes are limited to: S, M, L, XL, XXL
- All text fields are automatically converted to uppercase
- Date validation is performed on expiry dates

