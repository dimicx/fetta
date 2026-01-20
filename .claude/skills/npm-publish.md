# NPM Publish Skill

Publish the fetta package to npm.

## Prerequisites

- User must provide an npm **Granular Access Token** with:
  - Publish permissions for the `fetta` package
  - "Bypass 2FA for automation" enabled (if 2FA is on the account)

## Steps

### 1. Bump the version

Edit `packages/fetta/package.json` and increment the version:
- **Patch** (1.0.1 → 1.0.2): Bug fixes, minor changes, default value tweaks
- **Minor** (1.0.1 → 1.1.0): New features, non-breaking changes
- **Major** (1.0.1 → 2.0.0): Breaking changes

### 2. Build the package

```bash
cd /Users/dima/Projects/fetta/packages/fetta && pnpm build
```

### 3. Publish to npm

Use the auth token directly (NOT as `--otp`):

```bash
npm publish --registry https://registry.npmjs.org/ --//registry.npmjs.org/:_authToken=<TOKEN>
```

**Important:**
- Do NOT use `--otp=<token>` - that's for 6-digit TOTP codes only
- The automation token bypasses 2FA when passed as `_authToken`
- The `prepublishOnly` script will automatically rebuild before publishing

## Token Management

If publishing fails with auth errors:
1. Go to npmjs.com → Access Tokens → Generate New Token
2. Select "Granular Access Token"
3. Set permissions: "Read and write" for `fetta` package
4. Enable "Bypass 2FA for automation" if using 2FA/Passkey
5. Copy the token (starts with `npm_`)

## Example

```bash
# Bump version (edit package.json)
# Then publish:
npm publish --registry https://registry.npmjs.org/ --//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxx
```
