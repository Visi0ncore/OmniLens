# 👁️ OmniLens Mini

A simplified real-time dashboard for monitoring GitHub workflow runs for a single repository.

## ✨ Features

- **Real-time Data**: Fetches live workflow data from GitHub API
- **Date Selection**: View workflow runs for any specific date
- **Single Repository**: Monitors one configured repository
- **Metrics Overview**: Comprehensive metrics and analytics
- **Error Handling**: Proper error states when API calls fail
- **Simplified Interface**: Clean, focused dashboard without repository management

## 🏗️ Architecture

- **Next.js 14**: App router with React Server Components
- **TanStack Query**: Data fetching and caching
- **Tailwind CSS**: Styling and responsive design
- **TypeScript**: Type safety throughout

## 📊 Data Sources

The dashboard uses real GitHub API data exclusively:
- **GitHub Actions API**: Fetches workflow runs for specified dates
- **Real-time Updates**: No mock data or fallbacks
- **Error Handling**: Proper error states when API is unavailable

## 🔑 API Requirements

- GitHub Personal Access Token with `repo` scope
- Repository must have GitHub Actions enabled
- Token must have access to the specified repository
- Repository must be pre-configured (no user management interface)

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in the dashboard-mini directory:

```bash
# GitHub API Configuration
# Get your token from: https://github.com/settings/tokens
# Required scopes: repo (to access repository workflows)
GITHUB_TOKEN=your_github_token_here

# Database Configuration
# PostgreSQL connection settings
DB_USER=chris
DB_HOST=localhost
DB_NAME=omnilens
DB_PASSWORD=
DB_PORT=5432
```

**Note**: Replace `your_github_token_here` with your actual GitHub Personal Access Token. You can create one at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

### 2. Install Dependencies

```bash
bun install
```

### 3. Setup Database

Make sure PostgreSQL is running and create the database:

```bash
# Create database (if it doesn't exist)
createdb omnilens

# Run the schema
psql omnilens < lib/schema.sql
```

### 4. Start Development Server

```bash
bun run dev
```

## 📝 Repository Management

Dashboard-mini is designed to monitor a single repository with simplified management:

- **Add Repository**: Use the web interface when no repository is configured
- **Single Repository Constraint**: Only one repository can be added at a time
- **Remove Repository**: Delete button available to remove current repository
- **Clean Interface**: No clutter from multiple repository management
