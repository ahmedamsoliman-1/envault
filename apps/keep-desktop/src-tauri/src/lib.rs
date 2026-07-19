#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod secure_session;

/// Show the menu-bar window and bring it to the front.
#[cfg(desktop)]
fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Toggle the menu-bar window's visibility (left-click on the tray icon).
#[cfg(desktop)]
fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // Single-instance must be registered first: a second launch (e.g. from
    // Spotlight) just reveals the running window instead of spawning a copy.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }));
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    let app = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(secure_session::init())
        .invoke_handler(tauri::generate_handler![
            secure_session::secure_get_token,
            secure_session::secure_set_token,
            secure_session::secure_delete_token
        ])
        .setup(|_app| {
            #[cfg(desktop)]
            {
                let app = _app;
                // Menu-bar app: no Dock icon on macOS.
                #[cfg(target_os = "macos")]
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                let open =
                    MenuItem::with_id(app, "open", "Open Keep Clipboard", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &quit])?;

                let _tray = TrayIconBuilder::with_id("keep-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .icon_as_template(false)
                    .tooltip("Keep Clipboard")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => show_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            toggle_window(tray.app_handle());
                        }
                    })
                    .build(app)?;

                // Show the window on launch so first-run pairing is visible.
                show_window(app.handle());
            }
            Ok(())
        })
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            {
                let (window, event) = (_window, _event);
                // Closing the window just hides it — the app lives in the menu bar.
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        // Clicking the app again (Dock/Finder/Spotlight) reveals the window.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = &_event {
            show_window(_app_handle);
        }
    });
}
