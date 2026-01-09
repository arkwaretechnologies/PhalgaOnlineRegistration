# PHALGA Online Registration

A Next.js-based online registration system for the 17th Mindanao Geographic Conference.

## Features

- Dynamic registration form with participant management
- Province and LGU selection with auto-population
- Real-time registration status checking
- Supabase (PostgreSQL) database integration
- Responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Supabase project URL and anon key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with your configuration:
```
SUPABASE_URL=https://voitsxjrfqylbeebdaqq.supabase.co
SUPABASE_ANON_KEY=sb_publishable_DLnf9Uad5xi5fDwzqUwpRA_xRe6Xwhb
REGISTRATION_LIMIT=3
```

**Environment Variables:**
- `SUPABASE_URL` (required): Your Supabase project URL
- `SUPABASE_ANON_KEY` (required): Your Supabase anonymous/publishable key
- `REGISTRATION_LIMIT` (optional): Maximum number of participants allowed before registration closes. Default: 3

**Note:** For production (Railway), set these environment variables in your Railway project settings.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The application uses Supabase (PostgreSQL) with the following tables:

### REGH (Registration Header)
- REGNUM (Primary Key, SERIAL - Auto Increment)
- TRANSID (Unique 6-character identifier)
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

### Step 1: Run Migration in Supabase

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/20260109000000_create_tables.sql`

This will create all tables with proper indexes and Row Level Security policies.

### Step 2: Import LGUS Data (Optional)

If you have LGUS data from the original MySQL database, you can import it using:

1. Supabase Dashboard → Table Editor → LGUS
2. Use the import feature or run INSERT statements
3. Or use the Supabase CLI: `supabase db push`

### Step 3: Configure Row Level Security

The migration includes basic RLS policies for public read/insert access. Adjust these policies in Supabase Dashboard → Authentication → Policies based on your security requirements.

## API Routes

- `GET /api/check-registration` - Check if registration is open
- `GET /api/get-lgus?province=<province>` - Get LGUs for a province
- `POST /api/submit-registration` - Submit registration form

## Build for Production

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | - | Your Supabase anonymous/publishable key |
| `REGISTRATION_LIMIT` | No | 3 | Maximum number of participants before registration closes |

## Notes

- Registration closes when the participant count reaches or exceeds the configured limit (default: 3)
- T-shirt sizes are limited to: S, M, L, XL, XXL
- All text fields are automatically converted to uppercase
- Date validation is performed on expiry dates
- Each registration gets a unique TRANSID (6-character alphanumeric code)
- The application uses Supabase for database operations (PostgreSQL)

## Migration from MySQL

This application has been migrated from MySQL to Supabase. The database schema has been converted to PostgreSQL syntax with:
- SERIAL for auto-increment columns
- VARCHAR instead of CHAR (with length constraints where needed)
- Proper foreign key relationships
- Row Level Security (RLS) policies

