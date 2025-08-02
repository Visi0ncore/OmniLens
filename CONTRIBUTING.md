# Contributing to OmniLens

Thank you for your interest in contributing to OmniLens!  
This guide will help you get started with development and understand our contribution process.

## 🚀 Quick Development Setup

### Prerequisites

- **Node.js 18+** or **Bun** (recommended)
- **Git** 
- **GitHub Personal Access Token** with `repo` scope

### Initial Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/OmniLens.git
   cd OmniLens
   ```

2. **Dashboard Setup**
   ```bash
   cd dashboard
   bun install
   
   # Create environment file
   cp .env.example .env.local
   
   # Edit .env.local with your GitHub token:
   # GITHUB_TOKEN=your_github_token_here
   # GITHUB_REPO_1=your_org/your_repo
   
   # Start development server
   bun run dev
   ```

## 📁 Project Structure

```
OmniLens/
├── dashboard/           # Main workflow monitoring dashboard
│   ├── app/            # Next.js app directory (pages, API routes)
│   ├── components/     # Reusable React components
│   ├── lib/           # Utility functions and GitHub API integration
│   └── config/        # Workflow configuration files
├── docs/             # Documentation
└── utils/           # Shared utility scripts
```

## 🛠️ Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: We use Prettier and ESLint (configs included)
- **Naming**: Use camelCase for variables/functions, PascalCase for components
- **Imports**: Prefer absolute imports using `@/` prefix

### Component Guidelines

- **Functional Components**: Use function components with hooks
- **Props**: Define clear TypeScript interfaces for props
- **Accessibility**: Include proper ARIA labels and semantic HTML
- **Responsive**: Ensure components work on mobile and desktop

### API Guidelines

- **Error Handling**: Always include proper error handling and logging
- **Type Safety**: Define TypeScript interfaces for request/response data
- **Rate Limiting**: Consider rate limiting for public endpoints
- **Security**: Validate and sanitize all inputs

## 🧪 Testing

### Running Tests

```bash
# Dashboard tests
cd dashboard
bun run test           # Run all tests
bun run test:watch     # Watch mode for development

# Linting
bun run lint           # Check code style
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Use React Testing Library for component tests
- Aim for meaningful test coverage, not just high percentages

### Test Structure

```typescript
// Example test file
import { render, screen } from '@testing-library/react';
import { YourComponent } from './YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## 📝 Making Changes

### Before You Start

1. **Check Issues**: Look for existing issues or create a new one
2. **Discuss**: For large changes, discuss in an issue first
3. **Branch**: Create a feature branch from `main`

### Development Process

1. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   # Test dashboard changes
   cd dashboard
   bun run test
   bun run lint
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

Use conventional commits for clear history:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` code style changes (no functional changes)
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

Examples:
```
feat: add workflow review auto-collapse functionality
fix: resolve category expansion bug when reviewing workflows
docs: update API documentation for new endpoints
```

## 🔄 Pull Request Process

### Before Submitting

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation is updated (if needed)
- [ ] No merge conflicts with main branch

### Submitting a PR

1. **Push Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Use a clear, descriptive title
   - Include a detailed description of changes
   - Reference related issues (e.g., "Fixes #123")
   - Add screenshots for UI changes

3. **PR Template**
   ```markdown
   ## Description
   Brief description of changes made.
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Tests pass locally
   - [ ] Manual testing completed
   
   ## Screenshots (if UI changes)
   [Add screenshots here]
   ```

### Review Process

- PRs require at least one approval
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Be responsive to reviewer comments

## 🐛 Bug Reports

When reporting bugs, include:

- **Environment**: OS, browser, Node.js version
- **Steps to Reproduce**: Clear, step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Console Logs**: Any error messages

## 💡 Feature Requests

For new features:

- Check if similar functionality exists
- Describe the use case and benefits
- Consider implementation complexity
- Be open to alternative solutions

## 🔧 Common Development Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Define TypeScript interfaces for props
3. Implement component with proper accessibility
4. Add to component exports (if shared)
5. Write tests
6. Update Storybook (if applicable)

### Adding a New API Endpoint

1. Create route file in `app/api/` directory
2. Define TypeScript interfaces for request/response
3. Implement proper error handling
4. Add input validation
5. Write integration tests
6. Update API documentation

### Updating Workflow Configuration

1. Edit `dashboard/config/workflows.json`
2. Follow existing structure and naming
3. Test with your repository
4. Update documentation if adding new categories

## 🆘 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord**: [Add Discord link if available]
- **Email**: [Add contact email if desired]

## 📜 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributors graph

---

Thank you for contributing to OmniLens! Your efforts help make GitHub workflow monitoring better for everyone. 🎉