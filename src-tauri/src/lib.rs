mod yjs_server;

use yjs_server::YjsGardenServer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

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
