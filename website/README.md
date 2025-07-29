# OmniLens Website - Waiting List Implementation

A Next.js website with PostgreSQL-backed waiting list functionality for OmniLens.

## Features

- ✅ **Real Waiting List**: PostgreSQL database with Drizzle ORM
- ✅ **Email Validation**: Client and server-side validation with Zod
- ✅ **Duplicate Handling**: Graceful handling of duplicate emails
- ✅ **Live Statistics**: Real-time counter updates
- ✅ **Dark Theme**: Matches OmniLens dashboard styling
- ✅ **Vercel Ready**: Optimized for Vercel deployment

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

**Option A: Local PostgreSQL**

```bash
# Install PostgreSQL locally
# Create database and user with secure credentials
psql -U postgres -c "CREATE USER omnilens_user WITH ENCRYPTED PASSWORD 'your_secure_password';"
psql -U postgres -c "CREATE DATABASE omnilens_waitlist OWNER omnilens_user;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE omnilens_waitlist TO omnilens_user;"
```

**Option B: Vercel Postgres (Recommended)**

1. Go to [vercel.com/storage/postgres](https://vercel.com/storage/postgres)
2. Create a new PostgreSQL database
3. Copy the environment variables

### 3. Configure Environment

```bash
# Copy the example environment file
cp env.example .env.local

# Edit .env.local with your database credentials
# Replace 'your_secure_random_password_here' with a strong password
```

**Generate a secure password:**
```bash
openssl rand -base64 32
```

### 4. Run Database Migrations

```bash
# Generate migration files
npm run db:generate

# Push schema to database
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

### POST `/api/waitlist`

Add an email to the waiting list.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thanks for joining the waitlist!\nWe'll notify you when OmniLens is ready.",
  "count": 1248
}
```

### GET `/api/waitlist/stats`

Get current waiting list statistics.

**Response:**
```json
{
  "count": 1248,
  "latestSignups": 23
}
```

## Database Schema

```sql
CREATE TABLE waitlist_signups (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## Project Structure

```
website/
├── pages/
│   ├── api/
│   │   ├── waitlist.js          # Main waitlist endpoint
│   │   └── waitlist/
│   │       └── stats.js         # Statistics endpoint
│   └── index.js                 # Main landing page
├── lib/
│   ├── db.js                    # Database connection
│   ├── schema.js                # Drizzle schema definition
│   └── validations.js           # Zod validation schemas
├── drizzle.config.js            # Drizzle Kit configuration
├── next.config.js               # Next.js configuration
├── package.json                 # Dependencies and scripts
└── env.example                  # Environment variables template
```

## Deployment to Vercel

### 1. Connect Repository

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with default settings

### 2. Set Up Production Database

1. In Vercel Dashboard → Storage → Create Database
2. Select PostgreSQL
3. Environment variables are automatically configured

### 3. Run Production Migrations

```bash
# Pull production environment variables
vercel env pull .env.local

# Run migrations against production database
npm run db:push
```

### 4. Verify Deployment

Your waiting list should now be live with a real PostgreSQL database!

## Security Features

✅ **No Default Credentials**: Uses secure, unique database credentials  
✅ **SQL Injection Protection**: Drizzle ORM handles parameterized queries  
✅ **Input Validation**: Zod schemas validate all inputs  
✅ **CORS Headers**: Proper CORS configuration for API endpoints  
✅ **Error Handling**: Graceful error handling without exposing internals  

## Development Commands

```bash
# Start development server
npm run dev

# Generate database migration files
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_URL` | Main database connection string | Yes |
| `POSTGRES_PRISMA_URL` | Pooled connection string | Yes |
| `POSTGRES_URL_NON_POOLING` | Direct connection string | Yes |

**Local Development:**
- Copy `env.example` to `.env.local`
- Replace placeholder values with your database credentials

**Production (Vercel):**
- Environment variables automatically configured when you create Vercel Postgres database

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npm run db:studio
```

### Migration Issues

```bash
# Reset migrations (dev only)
rm -rf drizzle/
npm run db:generate
npm run db:push
```

### Environment Variables

```bash
# Check if environment variables are loaded
node -e "console.log(process.env.POSTGRES_URL)"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## License

MIT License - see LICENSE file for details 