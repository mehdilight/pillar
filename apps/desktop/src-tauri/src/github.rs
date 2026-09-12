use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;
use tauri::Manager;

use crate::{read_recents_from_disk, write_recents_to_disk, SiteInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    pub default_branch: String,
    pub private: bool,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAuthStatus {
    pub authenticated: bool,
    pub user: Option<GitHubUser>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}


// ---------------------------------------------------------------------------
// Token Storage
// ---------------------------------------------------------------------------

fn token_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config dir: {}", e))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    dir.push("github_token.json");
    Ok(dir)
}

pub fn get_saved_token(app: &AppHandle) -> Option<String> {
    let Ok(path) = token_file_path(app) else {
        return None;
    };
    if !path.exists() {
        return None;
    }
    let Ok(content) = fs::read_to_string(&path) else {
        return None;
    };
    #[derive(Deserialize)]
    struct TokenFile {
        token: String,
    }
    serde_json::from_str::<TokenFile>(&content).ok().map(|t| t.token)
}

pub fn save_token(app: &AppHandle, token: &str) -> Result<(), String> {
    let path = token_file_path(app)?;
    let content = serde_json::json!({ "token": token.trim() });
    fs::write(&path, content.to_string())
        .map_err(|e| format!("Failed to write github token: {}", e))?;
    Ok(())
}

pub fn delete_token(app: &AppHandle) -> Result<(), String> {
    let path = token_file_path(app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete token: {}", e))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// HTTP Helpers
// ---------------------------------------------------------------------------

fn github_client(token: Option<&str>) -> Result<reqwest::Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Pillar-Desktop (https://github.com/mehdilight/pillar)"),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );

    if let Some(tok) = token {
        let auth_val = format!("Bearer {}", tok.trim());
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_val).map_err(|e| format!("Invalid auth token: {}", e))?,
        );
    }

    reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

pub async fn fetch_github_user(token: &str) -> Result<GitHubUser, String> {
    let client = github_client(Some(token))?;
    let response = client
        .get("https://api.github.com/user")
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, body));
    }

    let user = response
        .json::<GitHubUser>()
        .await
        .map_err(|e| format!("Failed to parse user profile: {}", e))?;

    Ok(user)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn github_get_status(app: AppHandle) -> GitHubAuthStatus {
    if let Some(token) = get_saved_token(&app) {
        if let Ok(user) = fetch_github_user(&token).await {
            return GitHubAuthStatus {
                authenticated: true,
                user: Some(user),
            };
        }
    }
    GitHubAuthStatus {
        authenticated: false,
        user: None,
    }
}

#[tauri::command]
pub async fn github_save_token(app: AppHandle, token: String) -> Result<GitHubUser, String> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return Err("Token cannot be empty.".into());
    }

    // Verify token with GitHub
    let user = fetch_github_user(clean_token).await?;

    // Save token to disk
    save_token(&app, clean_token)?;

    Ok(user)
}

#[tauri::command]
pub fn github_logout(app: AppHandle) -> Result<(), String> {
    delete_token(&app)
}

#[tauri::command]
pub async fn github_list_repos(app: AppHandle) -> Result<Vec<GitHubRepo>, String> {
    let token = get_saved_token(&app).ok_or_else(|| "Not authenticated with GitHub.".to_string())?;

    let client = github_client(Some(&token))?;
    let response = client
        .get("https://api.github.com/user/repos?sort=updated&per_page=100&type=all")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch repositories: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let repos = response
        .json::<Vec<GitHubRepo>>()
        .await
        .map_err(|e| format!("Failed to parse repositories list: {}", e))?;

    Ok(repos)
}

#[tauri::command]
pub async fn github_clone_repo(
    app: AppHandle,
    _clone_url: String,
    full_name: String,
    target_dir: String,
) -> Result<SiteInfo, String> {
    let token = get_saved_token(&app).ok_or_else(|| "Not authenticated with GitHub.".to_string())?;
    let dest = Path::new(&target_dir);

    if dest.exists() && dest.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err("The selected directory already exists and is not empty.".into());
    }

    // Format authenticated git clone URL
    let authed_url = format!(
        "https://x-access-token:{}@github.com/{}.git",
        token.trim(),
        full_name.trim()
    );

    let output = Command::new("git")
        .arg("clone")
        .arg(&authed_url)
        .arg(&target_dir)
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed:\n{}", stderr));
    }

    // Configure remote to standard URL and set extraHeader for seamless future pushes
    let clean_remote = format!("https://github.com/{}.git", full_name.trim());
    let _ = Command::new("git")
        .current_dir(&dest)
        .arg("remote")
        .arg("set-url")
        .arg("origin")
        .arg(&clean_remote)
        .output();

    let header_config = format!("AUTHORIZATION: bearer {}", token.trim());
    let _ = Command::new("git")
        .current_dir(&dest)
        .arg("config")
        .arg("http.https://github.com/.extraHeader")
        .arg(&header_config)
        .output();

    // Check if site.json exists, or create a default one if this repo is being imported
    let site_json_path = dest.join("site.json");
    let site_name = if site_json_path.exists() {
        let Ok(content) = fs::read_to_string(&site_json_path) else {
            return Err("Unable to read site.json in cloned repository.".into());
        };
        serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(String::from))
            .unwrap_or_else(|| {
                dest.file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Pillar Site".into())
            })
    } else {
        // Auto-create site.json for repo without one
        let name = dest
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "Pillar Site".into());
        let site_json = serde_json::json!({
            "name": name,
            "base_url": "",
            "output": "dist",
            "deploy": "static",
            "addons": [],
            "plugins": []
        });
        let _ = fs::write(&site_json_path, serde_json::to_string_pretty(&site_json).unwrap());
        name
    };

    let site_info = SiteInfo {
        path: target_dir.clone(),
        name: site_name,
        last_opened: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    let mut recents = read_recents_from_disk(&app);
    recents.retain(|s| s.path != target_dir);
    recents.insert(0, site_info.clone());
    let _ = write_recents_to_disk(&app, &recents);

    Ok(site_info)
}

#[tauri::command]
pub async fn github_create_and_push_repo(
    app: AppHandle,
    site_path: String,
    repo_name: String,
    is_private: bool,
    description: Option<String>,
) -> Result<GitHubRepo, String> {
    let token = get_saved_token(&app).ok_or_else(|| "Not authenticated with GitHub.".to_string())?;
    let site_dir = Path::new(&site_path);
    if !site_dir.exists() {
        return Err("Site directory does not exist.".into());
    }

    // 1. Create repository on GitHub via API
    let client = github_client(Some(&token))?;
    let body = serde_json::json!({
        "name": repo_name.trim(),
        "private": is_private,
        "description": description.unwrap_or_else(|| "Pillar static site".into()),
        "auto_init": false
    });

    let res = client
        .post("https://api.github.com/user/repos")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to create GitHub repository: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, err_text));
    }

    let repo = res
        .json::<GitHubRepo>()
        .await
        .map_err(|e| format!("Failed to parse created repository response: {}", e))?;

    // 2. Initialize local git repository if not already initialized
    let git_dir = site_dir.join(".git");
    if !git_dir.exists() {
        let _ = Command::new("git")
            .current_dir(site_dir)
            .arg("init")
            .output();
    }

    // 3. Configure GitHub authentication header in git
    let header_config = format!("AUTHORIZATION: bearer {}", token.trim());
    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("config")
        .arg("http.https://github.com/.extraHeader")
        .arg(&header_config)
        .output();

    // 4. Commit files
    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("add")
        .arg(".")
        .output();

    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("commit")
        .arg("-m")
        .arg("Initial commit from Pillar Desktop")
        .output();

    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("branch")
        .arg("-M")
        .arg("main")
        .output();

    // 5. Add remote and push
    let remote_url = format!("https://github.com/{}.git", repo.full_name);
    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("remote")
        .arg("remove")
        .arg("origin")
        .output();

    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("remote")
        .arg("add")
        .arg("origin")
        .arg(&remote_url)
        .output();

    let push_output = Command::new("git")
        .current_dir(site_dir)
        .arg("push")
        .arg("-u")
        .arg("origin")
        .arg("main")
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;

    if !push_output.status.success() {
        let stderr = String::from_utf8_lossy(&push_output.stderr);
        return Err(format!("Repository created, but initial push failed:\n{}", stderr));
    }

    Ok(repo)
}

#[tauri::command]
pub fn github_push_site(app: AppHandle, site_path: String) -> Result<String, String> {
    let token = get_saved_token(&app).ok_or_else(|| "Not authenticated with GitHub.".to_string())?;
    let site_dir = Path::new(&site_path);
    if !site_dir.exists() {
        return Err("Site directory does not exist.".into());
    }

    let header_config = format!("AUTHORIZATION: bearer {}", token.trim());
    let _ = Command::new("git")
        .current_dir(site_dir)
        .arg("config")
        .arg("http.https://github.com/.extraHeader")
        .arg(&header_config)
        .output();

    let push_output = Command::new("git")
        .current_dir(site_dir)
        .arg("push")
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;

    if !push_output.status.success() {
        let stderr = String::from_utf8_lossy(&push_output.stderr);
        return Err(format!("Push failed:\n{}", stderr));
    }

    Ok("Successfully pushed changes to GitHub.".into())
}
