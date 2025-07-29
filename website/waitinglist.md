# Waiting List Implementation Plan

## Overview
Implement a PostgreSQL database with Drizzle ORM to store waiting list signups, replacing the current client-side simulation with proper backend functionality.

## Database Schema

### `waitlist_signups` table
```sql
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()
```

## Tech Stack
- **Database**: PostgreSQL (Vercel Postgres)
- **ORM**: Drizzle ORM
- **API**: Next.js API routes (Vercel Functions)
- **Validation**: Zod for schema validation
- **Deployment**: Vercel
- **Environment**: Vercel environment variables

## Implementation Steps

### 1. Database Setup
- [ ] Set up Vercel Postgres database (vercel.com/storage/postgres)
- [ ] Install Drizzle ORM dependencies
- [ ] Configure database connection with Vercel environment variables
- [ ] Create migration files using Drizzle Kit
- [ ] Run initial migration (locally and on Vercel)

### 2. Drizzle Schema Definition
```javascript
// schema.js
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const waitlistSignups = pgTable('waitlist_signups', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### 3. API Endpoints

#### POST `/api/waitlist` - Add email to waiting list
- **Input**: `{ email: string }`
- **Validation**: Email format, required field
- **Response**: 
```json
{ 
  "success": boolean, 
  "message": string, 
  "count": number 
}
```
- **Error handling**: Duplicate emails, invalid format, database errors

#### GET `/api/waitlist/stats` - Get waiting list statistics
- **Response**: 
```json
{ 
  "count": number, 
  "latestSignups": number 
}
```
- **Purpose**: Update frontend counters with real data

### 4. Frontend Integration
- [ ] Replace simulated counter with API calls
- [ ] Update `Join Waitlist` button to call POST endpoint
- [ ] Add loading states during API calls
- [ ] Handle API errors gracefully
- [ ] Periodically refresh stats (optional)

### 5. Required Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0"
  }
}
```

### 6. Environment Variables

**Local Development (.env.local):**
```env
# ⚠️  SECURITY: Never use default credentials like 'postgres/password'
# Generate strong, unique credentials for your local database
POSTGRES_URL="postgresql://omnilens_user:your_secure_random_password_here@localhost:5432/omnilens_waitlist"
POSTGRES_PRISMA_URL="postgresql://omnilens_user:your_secure_random_password_here@localhost:5432/omnilens_waitlist?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgresql://omnilens_user:your_secure_random_password_here@localhost:5432/omnilens_waitlist"
```

**Vercel Production:**
- Environment variables automatically set when using Vercel Postgres
- **Vercel automatically generates secure, unique credentials** - no manual setup needed
- Configure via Vercel Dashboard → Project Settings → Environment Variables
- Variables: `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`

**Security Best Practices:**
- **Never use default credentials** like `postgres/password` or `admin/admin`
- **Generate strong passwords**: Use tools like `openssl rand -base64 32`
- **Use unique database usernames**: Avoid generic names like `postgres` or `admin`
- **Local database setup example**:
  ```sql
  -- Create secure database user (not postgres default)
  CREATE USER omnilens_user WITH ENCRYPTED PASSWORD 'your_secure_random_password_here';
  CREATE DATABASE omnilens_waitlist OWNER omnilens_user;
  GRANT ALL PRIVILEGES ON DATABASE omnilens_waitlist TO omnilens_user;
  ```

### 7. Database Migration Commands

**Local Development:**
```bash
# Generate migration files
npx drizzle-kit generate:pg

# Push to local database
npx drizzle-kit push:pg
```

**Production (Vercel):**
```bash
# Set production database URL for migration
export POSTGRES_URL="your-vercel-postgres-url"

# Push schema to production
npx drizzle-kit push:pg

# Or run via Vercel CLI
vercel env pull .env.local
npx drizzle-kit push:pg
```

## API Implementation Details

### Error Handling Strategy
- **Duplicate email**: Return success with message "Already subscribed"
- **Invalid email**: Return validation error
- **Database errors**: Log error, return generic message
- **Rate limiting**: Consider implementing to prevent abuse

### Validation Schema (Zod)
```javascript
import { z } from 'zod';

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address").max(255)
});
```

### Sample API Route (Next.js/Vercel)
```javascript
// pages/api/waitlist.js (or app/api/waitlist/route.js for App Router)
import { db } from '@/lib/db';
import { waitlistSignups } from '@/lib/schema';
import { waitlistSchema } from '@/lib/validations';
import { sql } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { email } = waitlistSchema.parse(req.body);
      
      // Insert with conflict handling for duplicates
      await db.insert(waitlistSignups)
        .values({ email })
        .onConflictDoNothing();
      
      // Get total count
      const [{ count }] = await db.select({ 
        count: sql`count(*)::int` 
      }).from(waitlistSignups);
      
      res.status(200).json({ 
        success: true, 
        message: "Thanks for joining the waitlist!\nWe'll notify you when OmniLens is ready.",
        count 
      });
    } catch (error) {
      console.error('Waitlist error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Something went wrong. Please try again." 
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

## Frontend Updates Required

### 1. Replace Simulated Counter
```javascript
// Remove hardcoded numbers, fetch from API
async function fetchWaitlistStats() {
  const response = await fetch('/api/waitlist/stats');
  const data = await response.json();
  document.getElementById('joinedCount').textContent = data.count.toLocaleString();
}
```

### 2. Update Join Button Handler
```javascript
async function joinWaitlist(email) {
  const response = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  
  if (data.success) {
    showSuccess(data.message);
    updateCounter(data.count);
  } else {
    // Handle errors if needed
  }
}
```

## Deployment Considerations (Vercel)

### Database Setup
- **Primary Option**: Vercel Postgres (seamless integration)
  - Automatic environment variable setup
  - Built-in connection pooling
  - SSL certificates handled automatically
  - Integrated monitoring and analytics

### Vercel Deployment Process
1. **Connect Repository**: Link GitHub repo to Vercel
2. **Database Setup**: Create Vercel Postgres database via dashboard
3. **Environment Variables**: Automatically configured when database is linked
4. **Build Configuration**: 
   ```json
   {
     "buildCommand": "npm run build",
     "devCommand": "npm run dev",
     "framework": "nextjs"
   }
   ```

### Production Environment
- **Database**: Vercel Postgres with connection pooling
- **API Routes**: Serverless functions (automatically optimized)
- **SSL**: Handled by Vercel (automatic HTTPS)
- **Backups**: Managed by Vercel Postgres
- **Monitoring**: Vercel Analytics + Function logs

## Optional Enhancements

### Future Features
- [ ] Admin dashboard to view signups
- [ ] Export functionality (CSV)
- [ ] Email notification system
- [ ] Analytics tracking
- [ ] Duplicate prevention with better UX
- [ ] Bulk operations

### Security Considerations
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization
- [ ] GDPR compliance (data deletion)
- [ ] SQL injection prevention (handled by Drizzle)

## Next Steps (Vercel-Specific)
1. **Set up Vercel account** and connect GitHub repository
2. **Create Vercel Postgres database** via Vercel dashboard
3. **Set up local development environment** with Vercel CLI
4. **Implement database schema and migrations** using Drizzle
5. **Create Next.js API endpoints** with proper validation
6. **Update frontend** to use real API endpoints
7. **Test locally** with `vercel dev` command
8. **Deploy to Vercel** with automatic environment variable sync
9. **Run production migrations** via Vercel CLI

## Testing Strategy
- Unit tests for API endpoints
- Integration tests for database operations
- Frontend testing for API integration
- Load testing for expected traffic
