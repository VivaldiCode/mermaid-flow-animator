import { readFileSync, writeFileSync } from 'fs';

// Hooked into `npm version` — bumps the plugin's manifest.json + versions.json
// to match the new package.json version.
const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
  throw new Error('npm_package_version is not set. Run via `npm version`.');
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t') + '\n');

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t') + '\n');

console.log(
  `✓ Bumped to ${targetVersion} (compatible with Obsidian ≥ ${minAppVersion})`,
);
