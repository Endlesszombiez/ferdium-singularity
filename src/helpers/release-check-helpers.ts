import { Octokit } from '@octokit/core';
import semver from 'semver';

const REPO_OWNER = 'Endlesszombiez';
const REPO_NAME = 'ferdium-singularity';

const octokit = new Octokit();

/**
 * Fetches the latest release tag from the Endlesszombiez/ferdium-singularity
 * GitHub repository and compares it with the currently installed version.
 *
 * @returns The latest version string if an update is available, or null otherwise.
 */
export async function checkForNewerRelease(
  installedVersion: string,
): Promise<string | null> {
  try {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/releases/latest',
      {
        owner: REPO_OWNER,
        repo: REPO_NAME,
      },
    );

    if (response.status !== 200) {
      return null;
    }

    const latestTag: string = response.data.tag_name ?? '';
    // Strip leading "v" if present so semver can parse it
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = installedVersion.replace(/^v/, '');

    if (
      semver.valid(latestVersion) &&
      semver.valid(currentVersion) &&
      semver.gt(latestVersion, currentVersion)
    ) {
      return latestVersion;
    }

    return null;
  } catch {
    return null;
  }
}
