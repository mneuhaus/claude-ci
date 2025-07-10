# Claude CI Development Notes

## Release Process

To create a new release:

1. **Update version numbers**:
   - Update `version` in `package.json`
   - Update `VERSION` in `src/version.js`

2. **Commit changes**:
   ```bash
   git add .
   git commit -m "Your feature/fix description"
   ```

3. **Create version bump commit**:
   ```bash
   git commit -m "Bump version to X.Y.Z"
   ```

4. **Tag the release**:
   ```bash
   git tag vX.Y.Z
   ```

5. **Create release commit**:
   ```bash
   git commit -m "Release vX.Y.Z" --allow-empty
   ```

6. **Push to GitHub**:
   ```bash
   git push
   git push --tags
   ```

7. **Create GitHub release**:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes here"
   ```
   
   **Important**: Creating a GitHub release will automatically trigger the publish workflow (`.github/workflows/publish.yml`) which will publish the package to npm.

8. **Manual npm publish** (if needed):
   ```bash
   npm publish --otp=YOUR_OTP_CODE
   ```

## Development Guidelines

- Always test changes locally before committing
- Use meaningful commit messages
- Follow semantic versioning:
  - PATCH (x.x.1): Bug fixes
  - MINOR (x.1.x): New features (backwards compatible)
  - MAJOR (1.x.x): Breaking changes