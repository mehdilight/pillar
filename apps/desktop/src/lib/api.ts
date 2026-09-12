import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface SiteInfo {
  path: string;
  name: string;
  last_opened: number;
}

export interface SiteValidation {
  valid: boolean;
  name: string | null;
  path: string;
  error: string | null;
}

export interface ServerStatus {
  running: boolean;
  port: number | null;
  site_path: string | null;
  site_name: string | null;
  url: string | null;
  preview_url: string | null;
}

export interface PhpInfo {
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string | null;
}

export interface GitHubAuthStatus {
  authenticated: boolean;
  user: GitHubUser | null;
}

export const api = {
  async detectPhp(): Promise<PhpInfo> {
    return invoke<PhpInfo>('detect_php');
  },

  async pickFolder(): Promise<string | null> {
    return invoke<string | null>('pick_folder');
  },

  async validateSite(path: string): Promise<SiteValidation> {
    return invoke<SiteValidation>('validate_site', { path });
  },

  async startSiteServer(sitePath: string): Promise<ServerStatus> {
    return invoke<ServerStatus>('start_site_server', { sitePath });
  },

  async stopSiteServer(): Promise<ServerStatus> {
    return invoke<ServerStatus>('stop_site_server');
  },

  async getServerStatus(): Promise<ServerStatus> {
    return invoke<ServerStatus>('get_server_status');
  },

  async getRecentSites(): Promise<SiteInfo[]> {
    return invoke<SiteInfo[]>('get_recent_sites');
  },

  async removeRecentSite(path: string): Promise<SiteInfo[]> {
    return invoke<SiteInfo[]>('remove_recent_site', { path });
  },

  async openInFinder(path: string): Promise<void> {
    return invoke<void>('open_in_finder', { path });
  },

  async openInBrowser(url: string): Promise<void> {
    return invoke<void>('open_in_browser', { url });
  },

  async createSite(folderPath: string, siteName: string): Promise<SiteInfo> {
    return invoke<SiteInfo>('create_site', { folderPath, siteName });
  },

  async getStarterExamplePath(): Promise<string> {
    return invoke<string>('get_starter_example_path');
  },

  async getGithubStatus(): Promise<GitHubAuthStatus> {
    return invoke<GitHubAuthStatus>('github_get_status');
  },

  async saveGithubToken(token: string): Promise<GitHubUser> {
    return invoke<GitHubUser>('github_save_token', { token });
  },

  async githubLogout(): Promise<void> {
    return invoke<void>('github_logout');
  },

  async listGithubRepos(): Promise<GitHubRepo[]> {
    return invoke<GitHubRepo[]>('github_list_repos');
  },

  async cloneGithubRepo(fullName: string, targetDir: string, cloneUrl = ''): Promise<SiteInfo> {
    return invoke<SiteInfo>('github_clone_repo', { fullName, targetDir, cloneUrl });
  },

  async createAndPushGithubRepo(
    sitePath: string,
    repoName: string,
    isPrivate = true,
    description?: string
  ): Promise<GitHubRepo> {
    return invoke<GitHubRepo>('github_create_and_push_repo', {
      sitePath,
      repoName,
      isPrivate,
      description: description ?? null,
    });
  },

  async pushGithubSite(sitePath: string): Promise<string> {
    return invoke<string>('github_push_site', { sitePath });
  },

  listenMenuOpenSite(callback: () => void) {
    return listen('menu-open-site', () => callback());
  },

  listenMenuCloseSite(callback: () => void) {
    return listen('menu-close-site', () => callback());
  },

  listenMenuRevealFinder(callback: () => void) {
    return listen('menu-reveal-finder', () => callback());
  },
};
