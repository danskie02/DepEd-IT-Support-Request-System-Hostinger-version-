# Database Setup Guide

This guide will help you set up a local PostgreSQL database for the DepEd Request System.

## Prerequisites

- Windows 10/11
- Administrator access (for installation)

## Step 1: Install PostgreSQL

### Option A: Using PostgreSQL Installer (Recommended)

1. Download PostgreSQL from the official website:
   - Visit: https://www.postgresql.org/download/windows/
   - Click "Download the installer"
   - Download the latest version (e.g., PostgreSQL 16.x)

2. Run the installer:
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard
   - **Important**: Remember the password you set for the `postgres` superuser account
   - Keep the default port `5432` (or note if you change it)
   - Complete the installation

3. Verify installation:
   - Open PowerShell or Command Prompt
   - Run: `psql --version`
   - You should see the PostgreSQL version number

### Option B: Using Chocolatey (If you have it installed)

```powershell
choco install postgresql
```

## Step 2: Create the Database

After PostgreSQL is installed, you need to create the database:

1. Open PowerShell or Command Prompt

2. Connect to PostgreSQL (use the password you set during installation):
   ```powershell
   psql -U postgres
   ```

3. Create the database:
   ```sql
   CREATE DATABASE deped_requests;
   ```

4. Exit PostgreSQL:
   ```sql
   \q
   ```

## Step 3: Update .env File

1. Open the `.env` file in the project root

2. Update the `DATABASE_URL` with your PostgreSQL credentials:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/deped_requests
   ```
   
   Replace:
   - `YOUR_PASSWORD` with the password you set for the `postgres` user
   - `5432` with your PostgreSQL port if different
   - `deped_requests` with a different database name if you prefer

3. The `SESSION_SECRET` is already set with a secure random value - you don't need to change it unless you want to generate a new one.

## Step 4: Push Database Schema

Run the following command to create the database tables:

```powershell
npm run db:push
```

This will create all the necessary tables (users, requests, otps) based on your schema.

## Step 5: Verify Setup

1. Start the development server:
   ```powershell
   npm run dev
   ```

2. The server should start without database connection errors

3. Check the console for any initialization messages (e.g., "Seeded admin user")

## Troubleshooting

### PostgreSQL command not found

If `psql` is not recognized:
1. Add PostgreSQL to your PATH:
   - Default location: `C:\Program Files\PostgreSQL\{version}\bin`
   - Add this to your system PATH environment variable
   - Restart your terminal

### Connection refused / Authentication failed

- Verify PostgreSQL service is running:
  - Open Services (Win + R, type `services.msc`)
  - Find "postgresql-x64-{version}"
  - Ensure it's running

- Check your password in the `.env` file matches your PostgreSQL password

- Verify the port number (default is 5432)

### Database already exists

If you get an error that the database already exists:
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Drop and recreate (WARNING: This deletes all data)
DROP DATABASE deped_requests;
CREATE DATABASE deped_requests;
```

## Default Admin Credentials

After running `npm run dev`, a default admin user is created:
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@deped.gov.ph`

**Important**: Change these credentials in production!

## Next Steps

Once the database is set up:
1. Test the admin login page
2. Verify you can see the request list
3. Test approve/deny functionality
4. Proceed with user interface development

