mod yjs_server;

use yjs_server::YjsGardenServer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: None,
                        }),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    ])
                    .build(),
            )?;

            // Start Yjs WebSocket server for Garden Sync
            let server = YjsGardenServer::new();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server.run(8765).await {
                    log::error!("🔥 Garden server error: {}", e);
                }
            });

            log::info!("✅ Garden Sync server started on port 8765");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
