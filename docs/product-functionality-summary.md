# OmniLens Product Functionality Summary

## Overview
OmniLens is a real-time GitHub workflow monitoring and analytics platform that provides comprehensive visibility into CI/CD pipeline health, performance metrics, and workflow management.

## Core Platform Features

### Multi-Repository Support
- **Environment-Configured Repositories**: Pre-configured via environment variables
- **User-Added Repositories**: Dynamic addition through UI
- **Hybrid Mode**: Support for both configuration methods
- **Repository Isolation**: Independent state and configuration per repository

### Real-Time Data Synchronization
- **Time-Based Polling**: Automatic updates every 10 seconds for today's data
- **Focus-Based Updates**: Refresh when user returns to application tab
- **Manual Refresh**: User-initiated data updates
- **Background Sync**: Limited to visible tabs to conserve resources

## Repository Management

### Repository Addition
- **Input Validation**: Supports GitHub URLs and owner/repo format
- **Auto-Normalization**: Automatic conversion to standard format
- **Error Handling**: Comprehensive validation with user feedback
- **Access Control**: Validates repository existence and permissions

### Repository Removal
- **Confirmation Dialog**: User confirmation before removal
- **Data Cleanup**: Remove all associated data and configurations
- **State Persistence**: Update localStorage and UI state
- **Cache Invalidation**: Clear all cached data for the repository

### Repository Configuration
- **Environment Configuration**: Static configuration via `workflows.json`
- **User Configuration**: Dynamic configuration through UI
- **Hybrid Configuration**: Combination of both methods
- **Configuration Persistence**: Cross-session storage

## Workflow Monitoring

### Workflow Categorization
- **Build Workflows**: Compilation, packaging, and artifact generation
- **Testing Workflows**: Test suites, quality checks, and validation
- **Trigger Workflows**: Event-driven workflows and deployment triggers
- **Utility Workflows**: Helper workflows and automation scripts

### Workflow Run Tracking
- **Run Information**: ID, status, conclusion, timing, and URL
- **Status Monitoring**: Queued, in_progress, completed, failed states
- **Run Aggregation**: Group multiple runs by workflow file
- **Metadata Display**: Start time, duration, and completion details

### Missing Workflow Detection
- **Detection Logic**: Identify configured workflows that didn't run
- **Visual Indicators**: Placeholder cards for missing workflows
- **Configuration Validation**: Help identify configuration issues
- **Status Distinction**: Clear visual distinction between ran and missing workflows

## Analytics and Metrics

### Overview Metrics
- **Completed Runs**: Total number of completed workflow runs
- **In Progress Runs**: Currently running workflows
- **Passed/Failed Runs**: Successfully completed vs failed workflows
- **Total Runtime**: Cumulative execution time
- **Success Rate**: Percentage of successful runs
- **Missing Workflows**: Configured workflows that didn't run

### Daily Metrics Comparison
- **Success Rate Changes**: Improvement or regression in success rates
- **Runtime Changes**: Performance improvements or degradations
- **Run Count Changes**: Volume of workflow executions
- **Trend Analysis**: Pattern identification over time

### Performance Analytics
- **Average Runtime**: Mean execution time per workflow
- **Runtime Distribution**: Statistical distribution of run times
- **Failure Patterns**: Analysis of failure causes and frequencies
- **Resource Utilization**: Indirect measurement through runtime analysis

### Metric Visualization
- **Metric Cards**: Compact display of key metrics
- **Trend Indicators**: Visual trend arrows and indicators
- **Progress Bars**: Success rate and completion progress
- **Interactive Features**: Hover effects, click actions, highlighting

## Review System

### Workflow Review Tracking
- **Review State Management**: Track reviewed workflows per date and repository
- **Persistence Strategy**: Local storage with auto-save
- **Visual Indicators**: Clear feedback for reviewed workflows
- **Progress Tracking**: Overall review completion percentage

### Category Auto-Collapse
- **Auto-Collapse Logic**: Automatically collapse categories when all workflows are reviewed
- **Visual Feedback**: Clear indication of review progress
- **Manual Override**: Users can manually expand/collapse categories
- **Progress Tracking**: Review completion percentage per category

### Testing Workflow Integration
- **Automatic Trigger Review**: Mark trigger workflows as reviewed when all testing workflows are reviewed
- **Testing Workflow Tracking**: Individual tracking of testing workflow review states
- **Relationship Visualization**: Clear indication of trigger-testing relationships
- **Bulk Review Actions**: Review all related workflows with single action

## Configuration Management

### Workflow Configuration Modal
- **Available Workflows List**: Complete list of workflows in repository
- **Category Assignment**: Button-based categorization
- **Trigger Detection**: Automatic identification of trigger workflows
- **Testing Workflow Mapping**: Visual indication of trigger-testing relationships

### Trigger Mapping System
- **File-Based Mapping**: Based on workflow file names
- **Name-Based Mapping**: Based on workflow display names
- **Content Analysis**: Analysis of workflow file contents
- **Manual Override**: User-defined mappings

### Configuration Persistence
- **Local Storage**: Browser-based persistence for user configurations
- **Environment Variables**: Server-side configuration for pre-configured repositories
- **Hybrid Support**: Combination of both storage methods
- **Auto-Save**: Automatic saving of configuration changes

### Workflow Discovery
- **Smart Suggestions**: Suggest appropriate categories based on workflow names and content
- **Pattern Matching**: Identify common workflow patterns (build, test, deploy)
- **Usage Statistics**: Show workflow frequency and importance
- **Manual Override**: Allow users to override automatic suggestions

## Real-time Updates

### Data Synchronization
- **Polling**: Regular API calls to check for updates
- **Focus Events**: Refresh when user returns to application
- **Manual Refresh**: User-initiated data updates
- **Background Sync**: Limited to visible tabs

### Cache Management
- **Query Cache**: TanStack Query managed cache for API responses
- **Browser Cache**: HTTP cache headers for static resources
- **Local Storage**: Persistent cache for user preferences
- **Memory Cache**: In-memory cache for frequently accessed data

### Update Notifications
- **Loading States**: Skeleton components during data fetch
- **Update Indicators**: Visual cues for fresh data
- **Error States**: Clear error messages and retry options
- **Success Feedback**: Confirmation of successful updates

## User Interface Components

### Repository Cards
- **Repository Avatar**: GitHub user/organization avatar
- **Repository Name**: Formatted display name
- **Metrics Overview**: Key performance indicators
- **Status Indicators**: Error states and loading states
- **Action Buttons**: Delete, configure, and navigation options

### Workflow Cards
- **Workflow Name**: Clean, formatted workflow name
- **Status Indicators**: Visual status representation
- **Run Information**: Start time, duration, and conclusion
- **Review Controls**: Toggle review state
- **Action Links**: Direct links to GitHub Actions

### Metrics Components
- **Overview Metrics**: High-level performance indicators
- **Daily Metrics**: Day-over-day comparison
- **Trend Charts**: Visual trend analysis
- **Status Distribution**: Pie charts and bar graphs

### Date Picker
- **Calendar Interface**: Visual calendar for date selection
- **Quick Actions**: Today, yesterday, and custom date selection
- **Date Validation**: Ensure valid date ranges
- **State Management**: Integration with dashboard state

## Data Processing

### Workflow Data Normalization
- **Name Cleaning**: Remove emojis and standardize workflow names
- **Status Mapping**: Map GitHub statuses to internal representations
- **Duration Calculation**: Compute execution duration from timestamps
- **Boolean Flags**: Add convenient boolean flags for common checks

### Data Aggregation
- **Time-Based Aggregation**: Group runs by time periods
- **Category Aggregation**: Group runs by workflow categories
- **Status Aggregation**: Group runs by success/failure status
- **Performance Aggregation**: Calculate average runtimes and trends

### Data Filtering
- **Date Filtering**: Filter by specific dates or date ranges
- **Status Filtering**: Filter by workflow status
- **Category Filtering**: Filter by workflow categories
- **Performance Filtering**: Filter by runtime or success rate

## System Architecture

### Component Architecture
- **Modular Design**: Maintainable and scalable UI components
- **Component Hierarchy**: Clear separation of concerns
- **Reusable Components**: Shared UI components across pages
- **Page Structure**: Organized page layouts and navigation

### State Management
- **Application State**: Global application state
- **Page State**: Page-specific state
- **Component State**: Local component state
- **Cache State**: TanStack Query managed state
- **Persistent State**: localStorage backed state

### Error Handling
- **API Errors**: Network and GitHub API errors
- **Validation Errors**: Input validation failures
- **Configuration Errors**: Misconfigured workflows
- **Permission Errors**: Access control violations

### Performance Optimization
- **Code Splitting**: Lazy loading of components and pages
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: Efficient rendering of large lists
- **Debouncing**: User input debouncing
- **Caching**: Multiple layers of caching

## Key Benefits

### For Development Teams
- **Real-time Visibility**: Immediate insight into workflow health
- **Performance Monitoring**: Track and optimize CI/CD performance
- **Issue Detection**: Quickly identify and resolve workflow problems
- **Historical Analysis**: Understand trends and patterns over time

### For DevOps Engineers
- **Pipeline Health**: Monitor overall CI/CD pipeline status
- **Resource Optimization**: Identify performance bottlenecks
- **Automation Insights**: Understand workflow dependencies and relationships
- **Compliance Tracking**: Ensure workflows are running as expected

### For Project Managers
- **Status Overview**: High-level view of development pipeline health
- **Trend Analysis**: Understand development velocity and quality
- **Risk Assessment**: Identify potential issues before they impact delivery
- **Team Productivity**: Monitor workflow efficiency and success rates

## Technical Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **TanStack Query**: Data fetching and caching

### Backend
- **GitHub API**: Primary data source
- **Next.js API Routes**: Server-side API endpoints
- **Local Storage**: Client-side persistence
- **Browser APIs**: Modern web platform features

### Development Tools
- **Bun**: Fast JavaScript runtime
- **ESLint**: Code quality and consistency
- **TypeScript**: Static type checking
- **Git**: Version control and collaboration

---

This summary provides a concise overview of OmniLens functionality, highlighting key features, capabilities, and benefits for different user roles. For detailed implementation information, refer to the full product functionality documentation.
