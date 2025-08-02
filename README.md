# 👁️ OmniLens

> **Real-time GitHub workflow monitoring and analytics platform**

OmniLens provides comprehensive visibility into your GitHub Actions workflows with intelligent categorization, review tracking, and real-time metrics.  
Monitor workflow health, track performance trends, and ensure your CI/CD pipelines run smoothly.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ✨ Key Features

- **🔄 Real-time Monitoring**: Live GitHub Actions workflow data with automatic updates
- **📊 Smart Analytics**: Comprehensive metrics, trends, and performance insights  
- **🗂️ Category Organization**: Organize workflows by utility, trigger, testing, and build categories
- **✅ Review System**: Track workflow review status with persistent state management
- **📅 Historical Data**: View and analyze workflow runs for any date
- **🎯 Multi-Repository**: Monitor multiple repositories from a single dashboard

## 🏗️ Architecture

Real-time workflow monitoring and analytics platform built with:
- **Next.js 14** with App Router and React Server Components
- **TanStack Query** for efficient data fetching and caching
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS** for responsive design and styling
- **GitHub Actions API** integration for live workflow data

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** or **Bun** runtime
- **GitHub Personal Access Token** with `repo` scope

### Setup

```bash
# Navigate to dashboard
cd dashboard

# Install dependencies
bun install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your GitHub token and repository

# Start development server
bun run dev
```

The dashboard will be available at `http://localhost:3000`

## 📚 Documentation

- **[API Documentation](docs/dashboard/api.md)** - API endpoints and data structures
- **[Contributing Guide](CONTRIBUTING.md)** - Development setup and contribution guidelines

## 📊 Features

### Workflow Categories
- **⚡ Utility**: Helper workflows and automation scripts
- **🎯 Trigger**: Event-driven workflows and deployment triggers  
- **🧪 Testing**: Test suites, quality checks, and validation workflows
- **🔨 Build**: Compilation, packaging, and artifact generation

### Analytics & Metrics
- **Success Rate Tracking**: Monitor workflow reliability over time
- **Performance Trends**: Compare daily metrics and identify patterns
- **Status Overview**: Real-time view of running, passed, and failed workflows
- **Missing Workflow Detection**: Identify configured workflows that didn't run

### Review System
- **Workflow Review Tracking**: Mark workflows as reviewed with persistent state
- **Auto-collapse**: Automatically collapse fully reviewed categories
- **Date-specific State**: Review status tracked per date and repository
- **Testing Workflow Integration**: Automatic trigger review when all tests pass

## 🔧 Configuration

### Environment Variables

Create `dashboard/.env.local`:
```bash
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO_1=org/repo-name
GITHUB_REPO_2=org/another-repo  # Optional
GITHUB_REPO_3=org/third-repo    # Optional
```

### Workflow Configuration

Configure workflow categories in `dashboard/config/workflows.json`:

```json
{
  "your-repo-slug": {
    "repoPath": "org/repo-name",
    "categories": {
      "utility": {
        "name": "Utility",
        "workflows": ["cleanup.yml", "sync.yml"]
      },
      "testing": {
        "name": "Testing", 
        "workflows": ["test.yml", "e2e.yml"]
      }
    }
  }
}
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <strong>Built with ❤️ for better CI/CD visibility</strong>
</div>