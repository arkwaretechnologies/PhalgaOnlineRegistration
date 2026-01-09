# PHALGA Online Registration

A Next.js-based online registration system for the 18th Mindanao Geographic Conference.

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
PROVINCE_LGU_LIMIT=10
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Environment Variables:**
- `SUPABASE_URL` (required): Your Supabase project URL
- `SUPABASE_ANON_KEY` (required): Your Supabase anonymous/publishable key
- `REGISTRATION_LIMIT` (optional): Maximum number of participants allowed before registration closes. Default: 3
- `PROVINCE_LGU_LIMIT` (optional): Maximum number of participants allowed per Province-LGU combination. Default: 10
- `RESEND_API_KEY` (optional): Resend API key for sending confirmation emails. If not set, email functionality will be disabled.
- `RESEND_FROM_EMAIL` (optional): Email address to send from. Default: `onboarding@resend.dev` (for testing)
- `NEXT_PUBLIC_APP_URL` (required for production): Base URL of your application for email links and images. 
  - **IMPORTANT:** Must be set in production (Railway) to your production domain (e.g., `https://registration.phalga.org`)
  - Default: `http://localhost:3000` (only for local development)
  - **Without this, email images will not load correctly!**

**Note:** For production (Railway), set these environment variables in your Railway project settings:
1. Go to your Railway project → Variables
2. Add `NEXT_PUBLIC_APP_URL` with your production URL (e.g., `https://registration.phalga.org`)
3. Redeploy your application after adding the variable

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

## Email Configuration (Resend)

The application sends confirmation emails after successful registration using [Resend](https://resend.com).

### Setting Up Resend

1. **Create a Resend Account:**
   - Go to [https://resend.com](https://resend.com)
   - Sign up for a free account
   - Verify your email address

2. **Get Your API Key:**
   - Navigate to API Keys in your Resend dashboard
   - Create a new API key
   - Copy the API key (starts with `re_`)

3. **Configure Your Domain (Production):**
   - Add and verify your domain in Resend dashboard
   - This allows you to send emails from your own domain
   - For testing, you can use `onboarding@resend.dev` (default)

4. **Set Environment Variables:**
   - Add `RESEND_API_KEY` to your `.env.local` file
   - Optionally set `RESEND_FROM_EMAIL` to your verified domain email
   - Set `NEXT_PUBLIC_APP_URL` to your production URL for email links

### Email Features

- Automatic confirmation email sent after successful registration
- Includes transaction ID, registration details, and link to view registration
- Professional HTML email template
- Email sending is non-blocking (registration succeeds even if email fails)

**Note:** If `RESEND_API_KEY` is not set, the application will continue to work but emails will not be sent. Check the console logs for email status.

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

### Step 4: Set Up Storage for Payment Proofs

1. Go to Supabase Dashboard → SQL Editor
2. Run the migration file: `supabase/migrations/20260113000001_setup_payment_proofs_storage.sql`
   - This creates the `payment-proofs` storage bucket
   - Sets up RLS policies to allow public uploads and reads
   - Configures file size limit (5MB) and allowed file types

Alternatively, you can manually create the bucket:
1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `payment-proofs`
4. Set to Public
5. Add RLS policies in Storage → Policies:
   - Allow INSERT for public
   - Allow SELECT for public
   - Allow UPDATE for public (optional, for replacing files)
   - Allow DELETE for public (optional, for cleanup)

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
| `RESEND_API_KEY` | No | - | Resend API key for sending confirmation emails |
| `RESEND_FROM_EMAIL` | No | `onboarding@resend.dev` | Email address to send confirmation emails from |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Base URL of your application for email links |

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

