#[cfg(target_os = "android")]
use serde::Deserialize;
#[cfg(not(target_os = "android"))]
use std::marker::PhantomData;
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenResult {
    token: Option<String>,
}

pub(crate) struct SecureSession<R: Runtime> {
    #[cfg(target_os = "android")]
    handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    marker: PhantomData<fn() -> R>,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("secure-session-native")
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            let secure_session = SecureSession {
                handle: _api.register_android_plugin(
                    "space.aamsdn.keep_clipboard",
                    "SecureSessionPlugin",
                )?,
            };

            #[cfg(not(target_os = "android"))]
            let secure_session = SecureSession::<R> {
                marker: PhantomData,
            };

            app.manage(secure_session);
            Ok(())
        })
        .build()
}

#[tauri::command]
pub fn secure_get_token<R: Runtime>(
    _app: AppHandle<R>,
    secure_session: State<'_, SecureSession<R>>,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        return secure_session
            .handle
            .run_mobile_plugin::<TokenResult>("getToken", ())
            .map(|result| result.token)
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = secure_session;
        Err("secure session storage is only available on Android".to_string())
    }
}

#[tauri::command]
pub fn secure_set_token<R: Runtime>(
    _app: AppHandle<R>,
    secure_session: State<'_, SecureSession<R>>,
    token: String,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        return secure_session
            .handle
            .run_mobile_plugin("setToken", serde_json::json!({ "token": token }))
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (secure_session, token);
        Err("secure session storage is only available on Android".to_string())
    }
}

#[tauri::command]
pub fn secure_delete_token<R: Runtime>(
    _app: AppHandle<R>,
    secure_session: State<'_, SecureSession<R>>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        return secure_session
            .handle
            .run_mobile_plugin("deleteToken", ())
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = secure_session;
        Err("secure session storage is only available on Android".to_string())
    }
}
