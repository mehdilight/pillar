use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, State,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteInfo {
    pub path: String,
    pub name: String,
    pub last_opened: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteValidation {
    pub valid: bool,
    pub name: Option<String>,
    pub path: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub site_path: Option<String>,
    pub site_name: Option<String>,
    pub url: Option<String>,
    pub preview_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhpInfo {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

pub struct DesktopState {
    pub server_process: Arc<Mutex<Option<Child>>>,
    pub current_site: Arc<Mutex<Option<SiteInfo>>>,
    pub current_port: Arc<Mutex<Option<u16>>>,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            server_process: Arc::new(Mutex::new(None)),
            current_site: Arc::new(Mutex::new(None)),
            current_port: Arc::new(Mutex::new(None)),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config directory: {}", e))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    dir.push("recent_sites.json");
    Ok(dir)
}

fn read_recents_from_disk(app: &AppHandle) -> Vec<SiteInfo> {
    let Ok(path) = config_file_path(app) else {
        return Vec::new();
    };
    if !path.exists() {
        return Vec::new();
    }
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(mut sites) = serde_json::from_str::<Vec<SiteInfo>>(&content) else {
        return Vec::new();
    };
    sites.retain(|s| Path::new(&s.path).exists());
    sites
}

fn write_recents_to_disk(app: &AppHandle, sites: &[SiteInfo]) -> Result<(), String> {
    let path = config_file_path(app)?;
    let json = serde_json::to_string_pretty(sites)
        .map_err(|e| format!("Failed to serialize recent sites: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write recent sites: {}", e))?;
    Ok(())
}

fn resolve_php_binary() -> Result<(String, String), String> {
    let candidates = [
        "php",
        "/opt/homebrew/bin/php",
        "/usr/local/bin/php",
        "/usr/bin/php",
    ];

    for candidate in candidates {
        if let Ok(output) = Command::new(candidate).arg("-v").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let first_line = stdout.lines().next().unwrap_or("PHP").to_string();
                return Ok((candidate.to_string(), first_line));
            }
        }
    }

    Err("PHP binary not found in PATH or standard locations. Please install PHP 8.2 or higher.".into())
}

fn find_free_port() -> u16 {
    if let Ok(listener) = TcpListener::bind("127.0.0.1:7788") {
        drop(listener);
        return 7788;
    }
    if let Ok(listener) = TcpListener::bind("127.0.0.1:0") {
        if let Ok(addr) = listener.local_addr() {
            return addr.port();
        }
    }
    7788
}

fn resolve_pillar_paths(app: &AppHandle, site_path: &Path) -> Result<(PathBuf, PathBuf), String> {
    let vendor_router = site_path.join("vendor/phpmystic/pillar/src/Dev/router.php");
    let vendor_dashboard = site_path.join("vendor/phpmystic/pillar/public/editor");
    if vendor_router.exists() && vendor_dashboard.exists() {
        return Ok((vendor_router, vendor_dashboard));
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_router = resource_dir.join("src/Dev/router.php");
        let bundled_dashboard = resource_dir.join("public/editor");
        if bundled_router.exists() {
            return Ok((bundled_router, bundled_dashboard));
        }
    }

    let manifest_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let router = manifest_root.join("src/Dev/router.php");
    let dashboard = manifest_root.join("public/editor");

    if router.exists() {
        return Ok((router, dashboard));
    }

    Err(format!(
        "Could not locate Pillar router.php (checked workspace at {})",
        manifest_root.display()
    ))
}

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    while start.elapsed() < timeout {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(50)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(60));
    }
    false
}

fn stop_active_server(state: &DesktopState) {
    if let Ok(mut lock) = state.server_process.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    if let Ok(mut lock) = state.current_site.lock() {
        *lock = None;
    }
    if let Ok(mut lock) = state.current_port.lock() {
        *lock = None;
    }
}

// ---------------------------------------------------------------------------
// Commands Module
// ---------------------------------------------------------------------------

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn detect_php() -> PhpInfo {
        match resolve_php_binary() {
            Ok((path, version)) => PhpInfo {
                available: true,
                version: Some(version),
                path: Some(path),
                error: None,
            },
            Err(e) => PhpInfo {
                available: false,
                version: None,
                path: None,
                error: Some(e),
            },
        }
    }

    #[tauri::command]
    pub async fn pick_folder() -> Result<Option<String>, String> {
        let folder = rfd::AsyncFileDialog::new()
            .set_title("Select Pillar Site Folder")
            .pick_folder()
            .await;

        Ok(folder.map(|h| h.path().to_string_lossy().to_string()))
    }

    #[tauri::command]
    pub fn validate_site(path: String) -> SiteValidation {
        let dir = Path::new(&path);
        if !dir.exists() || !dir.is_dir() {
            return SiteValidation {
                valid: false,
                name: None,
                path,
                error: Some("The selected folder does not exist or is not a directory.".into()),
            };
        }

        let site_json_path = dir.join("site.json");
        if !site_json_path.exists() {
            return SiteValidation {
                valid: false,
                name: None,
                path,
                error: Some("Folder is missing 'site.json'. Is this a Pillar site?".into()),
            };
        }

        let Ok(content) = fs::read_to_string(&site_json_path) else {
            return SiteValidation {
                valid: false,
                name: None,
                path,
                error: Some("Unable to read site.json.".into()),
            };
        };

        let site_name = serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(String::from))
            .unwrap_or_else(|| {
                dir.file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Pillar Site".into())
            });

        SiteValidation {
            valid: true,
            name: Some(site_name),
            path,
            error: None,
        }
    }

    #[tauri::command]
    pub fn start_site_server(
        app: AppHandle,
        state: State<'_, DesktopState>,
        site_path: String,
    ) -> Result<ServerStatus, String> {
        let validation = validate_site(site_path.clone());
        if !validation.valid {
            return Err(validation.error.unwrap_or_else(|| "Invalid site".into()));
        }
        let site_name = validation.name.unwrap_or_else(|| "Pillar Site".into());

        stop_active_server(&state);

        let (php_bin, _) = resolve_php_binary()?;
        let site_dir = PathBuf::from(&site_path);
        let (router_path, dashboard_path) = resolve_pillar_paths(&app, &site_dir)?;
        let port = find_free_port();

        let mut cmd = Command::new(&php_bin);
        cmd.arg("-S")
            .arg(format!("127.0.0.1:{}", port))
            .arg(&router_path)
            .current_dir(&site_dir)
            .env("PILLAR_SITE", &site_path)
            .env("PILLAR_DASHBOARD", &dashboard_path)
            .env("PHP_CLI_SERVER_WORKERS", "4")
            .env("PATH", std::env::var("PATH").unwrap_or_default())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn PHP server: {}", e))?;

        if !wait_for_server(port, Duration::from_secs(3)) {
            if let Ok(Some(status)) = child.try_wait() {
                let mut err_msg = format!("Server exited immediately with status: {}", status);
                if let Some(mut stderr) = child.stderr.take() {
                    use std::io::Read;
                    let mut buf = String::new();
                    if stderr.read_to_string(&mut buf).is_ok() && !buf.is_empty() {
                        err_msg = format!("{}\n{}", err_msg, buf);
                    }
                }
                return Err(err_msg);
            }
        }

        let site_info = SiteInfo {
            path: site_path.clone(),
            name: site_name.clone(),
            last_opened: current_timestamp(),
        };

        if let Ok(mut lock) = state.server_process.lock() {
            *lock = Some(child);
        }
        if let Ok(mut lock) = state.current_site.lock() {
            *lock = Some(site_info.clone());
        }
        if let Ok(mut lock) = state.current_port.lock() {
            *lock = Some(port);
        }

        let mut recents = read_recents_from_disk(&app);
        recents.retain(|s| s.path != site_path);
        recents.insert(0, site_info);
        let _ = write_recents_to_disk(&app, &recents);

        let url = format!("http://127.0.0.1:{}/", port);
        let preview_url = format!("http://127.0.0.1:{}/preview/", port);

        Ok(ServerStatus {
            running: true,
            port: Some(port),
            site_path: Some(site_path),
            site_name: Some(site_name),
            url: Some(url),
            preview_url: Some(preview_url),
        })
    }

    #[tauri::command]
    pub fn stop_site_server(state: State<'_, DesktopState>) -> ServerStatus {
        stop_active_server(&state);
        ServerStatus {
            running: false,
            port: None,
            site_path: None,
            site_name: None,
            url: None,
            preview_url: None,
        }
    }

    #[tauri::command]
    pub fn get_server_status(state: State<'_, DesktopState>) -> ServerStatus {
        let running = state
            .server_process
            .lock()
            .ok()
            .and_then(|mut p| {
                if let Some(ref mut child) = *p {
                    match child.try_wait() {
                        Ok(None) => Some(true),
                        _ => Some(false),
                    }
                } else {
                    Some(false)
                }
            })
            .unwrap_or(false);

        let site = state.current_site.lock().ok().and_then(|s| s.clone());
        let port = state.current_port.lock().ok().and_then(|p| *p);

        let url = port.map(|p| format!("http://127.0.0.1:{}/", p));
        let preview_url = port.map(|p| format!("http://127.0.0.1:{}/preview/", p));

        ServerStatus {
            running,
            port,
            site_path: site.as_ref().map(|s| s.path.clone()),
            site_name: site.as_ref().map(|s| s.name.clone()),
            url,
            preview_url,
        }
    }

    #[tauri::command]
    pub fn get_recent_sites(app: AppHandle) -> Vec<SiteInfo> {
        read_recents_from_disk(&app)
    }

    #[tauri::command]
    pub fn remove_recent_site(app: AppHandle, path: String) -> Result<Vec<SiteInfo>, String> {
        let mut recents = read_recents_from_disk(&app);
        recents.retain(|s| s.path != path);
        write_recents_to_disk(&app, &recents)?;
        Ok(recents)
    }

    #[tauri::command]
    pub fn open_in_finder(path: String) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg("-R")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open in Finder: {}", e))?;
            Ok(())
        }
        #[cfg(not(target_os = "macos"))]
        {
            open::that(&path).map_err(|e| format!("Failed to open folder: {}", e))?;
            Ok(())
        }
    }

    #[tauri::command]
    pub fn open_in_browser(url: String) -> Result<(), String> {
        open::that(&url).map_err(|e| format!("Failed to open URL in browser: {}", e))?;
        Ok(())
    }

    #[tauri::command]
    pub fn create_site(
        app: AppHandle,
        folder_path: String,
        site_name: String,
    ) -> Result<SiteInfo, String> {
        let base_dir = Path::new(&folder_path);

        let pages_dir = base_dir.join("content/pages");
        let posts_dir = base_dir.join("content/posts");
        let layout_dir = base_dir.join("layout");
        let sections_dir = base_dir.join("sections");

        fs::create_dir_all(&pages_dir).map_err(|e| format!("Failed to create pages dir: {}", e))?;
        fs::create_dir_all(&posts_dir).map_err(|e| format!("Failed to create posts dir: {}", e))?;
        fs::create_dir_all(&layout_dir).map_err(|e| format!("Failed to create layout dir: {}", e))?;
        fs::create_dir_all(&sections_dir)
            .map_err(|e| format!("Failed to create sections dir: {}", e))?;

        let site_json = serde_json::json!({
            "name": site_name,
            "base_url": "",
            "output": "dist",
            "deploy": "static",
            "addons": [],
            "plugins": []
        });
        fs::write(
            base_dir.join("site.json"),
            serde_json::to_string_pretty(&site_json).unwrap(),
        )
        .map_err(|e| format!("Failed to write site.json: {}", e))?;

        let layout_content = format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{{{ site.name }}}}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 48rem;
      margin: 3rem auto;
      padding: 0 1.5rem;
      line-height: 1.6;
      color: #1c1917;
      background: #fafaf9;
    }}
    h1 {{ font-size: 2.25rem; font-weight: 700; margin-bottom: 1rem; color: #0c0a09; }}
    a {{ color: #0284c7; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <header>
    <h1>{{{{ site.name }}}}</h1>
  </header>
  <main>
    {{{{ content }}}}
  </main>
</body>
</html>
"#
        );
        fs::write(layout_dir.join("default.html"), layout_content)
            .map_err(|e| format!("Failed to write default layout: {}", e))?;

        let home_content = format!(
            r#"---
title: Welcome to {}
slug: /
layout: default
---
Welcome to your new **{}** site!

You can edit this page, write blog posts, configure layouts, and preview changes in real time right here inside the Pillar desktop app.
"#,
            site_name, site_name
        );
        fs::write(pages_dir.join("home.md"), home_content)
            .map_err(|e| format!("Failed to write home page: {}", e))?;

        let site_info = SiteInfo {
            path: folder_path.clone(),
            name: site_name,
            last_opened: current_timestamp(),
        };

        let mut recents = read_recents_from_disk(&app);
        recents.retain(|s| s.path != folder_path);
        recents.insert(0, site_info.clone());
        let _ = write_recents_to_disk(&app, &recents);

        Ok(site_info)
    }

    #[tauri::command]
    pub fn get_starter_example_path() -> Result<String, String> {
        let manifest_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        let starter = manifest_root.join("examples/starter");
        if starter.join("site.json").exists() {
            Ok(starter.to_string_lossy().to_string())
        } else {
            Err("Starter example not found".into())
        }
    }
}

// ---------------------------------------------------------------------------
// App Entrypoint
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let desktop_state = DesktopState::default();
    let server_process = Arc::clone(&desktop_state.server_process);

    let builder = tauri::Builder::default()
        .manage(desktop_state)
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle();

            let open_site_item = MenuItemBuilder::with_id("open_site", "Open Site Folder...")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?;
            let close_site_item = MenuItemBuilder::with_id("close_site", "Close Site / Back to Launcher")
                .accelerator("CmdOrCtrl+W")
                .build(handle)?;
            let reveal_item = MenuItemBuilder::with_id("reveal_finder", "Reveal Site in Finder")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(handle)?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(&open_site_item)
                .item(&close_site_item)
                .separator()
                .item(&reveal_item)
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let reload_item = MenuItemBuilder::with_id("reload", "Reload Window")
                .accelerator("CmdOrCtrl+R")
                .build(handle)?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .item(&reload_item)
                .separator()
                .fullscreen()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "open_site" => {
                        let _ = app_handle.emit("menu-open-site", ());
                    }
                    "close_site" => {
                        let _ = app_handle.emit("menu-close-site", ());
                    }
                    "reveal_finder" => {
                        let _ = app_handle.emit("menu-reveal-finder", ());
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::detect_php,
            commands::pick_folder,
            commands::validate_site,
            commands::start_site_server,
            commands::stop_site_server,
            commands::get_server_status,
            commands::get_recent_sites,
            commands::remove_recent_site,
            commands::open_in_finder,
            commands::open_in_browser,
            commands::create_site,
            commands::get_starter_example_path,
        ]);

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                if let Ok(mut lock) = server_process.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
