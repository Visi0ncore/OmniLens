# 👁️ OmniLens

A real-time dashboard for monitoring GitHub workflow runs.

## ✨ Features

- **Real-time Data**: Fetches live workflow data from GitHub API
- **Date Selection**: View workflow runs for any specific date
- **Workflow Management**: Simple and unified workflow monitoring
- **Review System**: Mark workflows as reviewed with persistent state
- **Metrics Overview**: Comprehensive metrics and analytics
- **Error Handling**: Proper error states when API calls fail

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

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in the dashboard directory:

```bash
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO=your_org/your_repo
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Start Development Server

```bash
bun run dev
```
