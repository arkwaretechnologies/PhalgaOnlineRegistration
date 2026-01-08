# Quick Start Guide

## Step 1: Install MySQL

Choose one of these options:

### Option A: MySQL Community Server (Official)
1. Download from: https://dev.mysql.com/downloads/installer/
2. Run installer, choose "Developer Default"
3. Set root password during installation
4. Complete installation

### Option B: XAMPP (Easier)
1. Download from: https://www.apachefriends.org/download.html
2. Install XAMPP
3. Start MySQL from XAMPP Control Panel
4. Default password: (empty/blank)

## Step 2: Create Database

After MySQL is installed, run the setup script:

### Using MySQL Command Line:
```bash
mysql -u root -p < database-setup.sql
```

### Using MySQL Workbench:
1. Open MySQL Workbench
2. Connect to your server
3. File → Open SQL Script → Select `database-setup.sql`
4. Click "Execute" (lightning bolt icon)

### Using Command Line Manually:
```bash
mysql -u root -p
```
Then paste the contents of `database-setup.sql`

## Step 3: Configure Environment

Create `.env.local` file in project root:

```
DB_HOST=localhost
DB_NAME=PHALGA
DB_USER=root
DB_PASSWORD=your_mysql_password_here
```

Replace `your_mysql_password_here` with your MySQL root password.

## Step 4: Install Dependencies & Run

```bash
npm install
npm run dev
```

## Step 5: Access Application

Open browser: http://localhost:3000

## Troubleshooting

### MySQL Service Not Running
- **Windows:** Open Services (Win+R → services.msc) → Find MySQL → Start
- **XAMPP:** Use XAMPP Control Panel → Start MySQL

### Can't Connect to Database
- Verify MySQL is running
- Check `.env.local` credentials
- Test connection: `mysql -u root -p`

### Port 3306 in Use
- Check: `netstat -ano | findstr :3306`
- Stop conflicting service or change MySQL port

