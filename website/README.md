# 🌐 OmniLens Website

> **Secure landing page and waitlist management for OmniLens**

A bulletproof Next.js website with PostgreSQL-backed waiting list functionality, featuring comprehensive security and abuse prevention. This component serves as the public-facing website for OmniLens with secure user registration capabilities.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue)
![Security](https://img.shields.io/badge/Security-Multi--Layer-green)

## ✨ Features

- ✅ **Secure Waiting List**: PostgreSQL database with direct pg client
- ✅ **Multi-Layer Security**: Rate limiting, IP blocking, and abuse prevention
- ✅ **Email Validation**: Enhanced client and server-side validation
- ✅ **Database Management**: Secure command-line tools with no password exposure
- ✅ **Static HTML Frontend**: Fast, reliable UI with Tailwind CSS styling
- ✅ **Real-time Statistics**: Live counter updates via API
- ✅ **Production Ready**: Comprehensive error handling and monitoring

## 🔒 Security Features

🛡️ **Backend Protection:**
- **Rate Limiting**: Max 5 signups per IP per hour
- **Burst Protection**: Max 3 requests per minute per IP
- **IP Blocking**: 1-hour automatic blocks for abusers
- **Email Deduplication**: 24-hour cooldown per email address
- **Input Sanitization**: Email cleaning and validation
- **SQL Injection Protection**: Parameterized queries only
- **Security Headers**: XSS, CSRF, and clickjacking protection

🪖 **Frontend Protection:**
- **5-second cooldown** between form submissions
- **Enhanced email validation** (254 character limit, proper regex)
- **User-friendly error messages** with visual feedback
- **Network error handling** with retry guidance

⛑️ **Monitoring & Logging:**
- **Successful signups logged** with email and count
- **Failed attempts logged** with IP addresses and timestamps
- **Automatic cleanup** of old rate limit data
- **Attack pattern detection** and blocking

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Database

**Local PostgreSQL Setup:**

```bash
# Install PostgreSQL locally
# Create database and user with secure credentials
psql -U postgres -c "CREATE DATABASE omnilens_waitlist;"
psql -U postgres -c "CREATE USER omnilens_user WITH ENCRYPTED PASSWORD 'your_secure_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE omnilens_waitlist TO omnilens_user;"
```

**Create the waitlist table:**

```sql
CREATE TABLE waitlist_signups (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Configure Environment

Create `.env.local` with your database credentials:

```bash
POSTGRES_URL="postgresql://omnilens_user:your_secure_password@localhost:5432/omnilens_waitlist"
POSTGRES_PRISMA_URL="postgresql://omnilens_user:your_secure_password@localhost:5432/omnilens_waitlist?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgresql://omnilens_user:your_secure_password@localhost:5432/omnilens_waitlist"
```

**Generate a secure password:**
```bash
openssl rand -base64 32
```

### 4. Set Up Secure Database Access

The system automatically creates a secure `.pgpass` file for password-free database access.

### 5. Start Development Server

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📡 API Endpoints

### POST `/api/waitlist`

Add an email to the waiting list with comprehensive security checks.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Thanks for joining the waitlist!\nWe'll notify you when OmniLens is ready.",
  "count": 1248
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

```json
{
  "success": false,
  "message": "This email was recently used. Please try again tomorrow."
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

## 🗄️ Database Management

**Secure database access without exposing passwords:**

```bash
# View signup statistics
bun run db:stats

# List all signups (newest first)
bun run db:list

# Show recent signups (last 24 hours)
bun run db:recent

# Interactive database connection
bun run db:connect

# Reset database (with confirmation prompt)
bun run db:reset
```

## 📁 Project Structure

```
website/
├── pages/
│   └── api/
│       ├── waitlist.js          # Secure waitlist endpoint with rate limiting
│       └── waitlist/
│           └── stats.js         # Statistics endpoint
├── public/
│   └── index.html               # Static HTML frontend with security features
├── lib/
│   └── security.js              # Comprehensive security middleware
├── db-connect.sh                # Secure database connection script
├── db-reset.sh                  # Safe database reset script
├── next.config.js               # Next.js configuration for static HTML
├── package.json                 # Dependencies and database scripts
└── .env.local                   # Environment variables (not in repo)
```

## 🔒 Security Implementation

### Rate Limiting Configuration

```javascript
const RATE_LIMITS = {
  PER_IP_PER_HOUR: 5,        // Max 5 signups per IP per hour
  PER_EMAIL_PER_DAY: 1,      // Max 1 signup per email per day
  BURST_LIMIT: 3,            // Max 3 requests per minute from same IP
  BLOCK_DURATION: 60 * 60 * 1000, // 1 hour IP block
};
```

### Attack Resistance

- ✅ **Script attacks**: Blocked by multi-layer rate limiting
- ✅ **Email bombing**: 24-hour email cooldown prevents spam
- ✅ **IP abuse**: Automatic temporary IP blocking
- ✅ **Rapid requests**: Burst protection with escalating blocks
- ✅ **Invalid data**: Comprehensive input validation and sanitization
- ✅ **Database attacks**: Parameterized queries prevent SQL injection
- ✅ **XSS attacks**: Security headers and input sanitization
- ✅ **CSRF attacks**: Proper headers and origin validation

## 🛠️ Development Commands

```bash
# Start development server
bun run dev

# Database management
bun run db:stats              # Show signup count
bun run db:list               # List all signups
bun run db:recent             # Show recent signups
bun run db:connect            # Interactive database access
bun run db:reset              # Reset database (with confirmation)

# Build and deployment
bun run build                 # Build for production
bun run start                 # Start production server
```

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_URL` | Main database connection string | Yes |
| `POSTGRES_PRISMA_URL` | Pooled connection string | Yes |
| `POSTGRES_URL_NON_POOLING` | Direct connection string | Yes |

## 🚀 Production Deployment

### 1. Database Setup

Set up a PostgreSQL database with the required table structure.

### 2. Environment Configuration

Configure environment variables with your production database credentials.

### 3. Security Considerations

- Use strong, unique database passwords
- Enable SSL for database connections in production
- Configure proper firewall rules
- Monitor logs for abuse patterns
- Consider using Redis for rate limiting in high-traffic scenarios

## 📊 Monitoring & Maintenance

### Log Monitoring

The system logs all signup attempts with timestamps and IP addresses:

```
✅ Successful signup: user@example.com (Total: 1248)
❌ Waitlist error: Rate limit exceeded for IP: 192.168.1.1
```

### Database Maintenance

```bash
# Check database health
bun run db:stats

# Monitor recent activity
bun run db:recent

# Clean up test data
bun run db:reset
```

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
bun run db:connect

# Check environment variables
echo $POSTGRES_URL
```

### Rate Limiting Issues

If legitimate users are being blocked:

1. Check the rate limiting configuration in `lib/security.js`
2. Adjust `RATE_LIMITS` values as needed
3. Restart the server to apply changes

### Security Alerts

Monitor logs for patterns like:
- Multiple rapid requests from same IP
- Invalid email formats
- Repeated duplicate email attempts

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 Related

- **[Main OmniLens Dashboard](../dashboard/)** - Real-time workflow monitoring
- **[Contributing Guide](../CONTRIBUTING.md)** - Development and contribution guidelines
- **[Project Documentation](../docs/)** - Comprehensive guides and API reference

---

<div align="center">
  <strong>Part of the OmniLens ecosystem</strong><br>
  <a href="../README.md">← Back to main project</a>
</div> 