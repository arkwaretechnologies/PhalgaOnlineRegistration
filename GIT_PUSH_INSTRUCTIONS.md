# Git Push Instructions

Since Git is not available in the current terminal, please follow these steps manually:

## Prerequisites
1. Make sure Git is installed on your system
2. Ensure you have access to the GitHub repository: https://github.com/arkwaretechnologies/PhalgaOnlineRegistration

## Steps to Push Code

### 1. Open Git Bash or Command Prompt
Navigate to your project directory:
```bash
cd "D:\Arkware\Phalga Online Registration"
```

### 2. Initialize Git Repository (if not already initialized)
```bash
git init
```

### 3. Add Remote Repository
```bash
git remote add origin https://github.com/arkwaretechnologies/PhalgaOnlineRegistration.git
```

If the remote already exists, update it:
```bash
git remote set-url origin https://github.com/arkwaretechnologies/PhalgaOnlineRegistration.git
```

### 4. Stage All Files
```bash
git add .
```

### 5. Commit Changes
```bash
git commit -m "Initial commit: Next.js registration app with cPanel deployment configuration"
```

### 6. Set Default Branch (if needed)
```bash
git branch -M main
```

### 7. Push to GitHub
```bash
git push -u origin main
```

If you encounter authentication issues, you may need to:
- Use a Personal Access Token instead of password
- Or use SSH: `git remote set-url origin git@github.com:arkwaretechnologies/PhalgaOnlineRegistration.git`

## Alternative: Using GitHub Desktop or VS Code
You can also use:
- **GitHub Desktop**: Clone the repository and push through the GUI
- **VS Code**: Use the built-in Git features in the Source Control panel

## Files Included in Commit
- All source code files
- Configuration files (package.json, next.config.js, tsconfig.json, etc.)
- server.js (new file for cPanel deployment)
- Documentation files (README.md, SETUP.md, etc.)

## Files Excluded (via .gitignore)
- node_modules/
- .next/
- .env.local
- Build artifacts
- Other temporary files
