use base64::Engine;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use tauri::Manager;

const KEYRING_SERVICE: &str = "visionhub-studio";

#[derive(Debug, Deserialize)]
struct SaveSecretRequest {
    provider_id: String,
    secret: String,
}

#[derive(Debug, Serialize)]
struct SecretStatus {
    provider_id: String,
    available: bool,
}

#[derive(Debug, Deserialize)]
struct OpenAIImageRequest {
    provider_id: String,
    model_id: String,
    prompt: String,
    size: String,
    quality: Option<String>,
    count: u8,
    generation_mode: Option<String>,
    reference_images: Option<Vec<ReferenceImage>>,
    base_url: Option<String>,
    protocol: Option<String>,
    endpoint_path: Option<String>,
    extra_headers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ReferenceImage {
    id: String,
    name: Option<String>,
    mime_type: Option<String>,
    data_url: Option<String>,
    local_path: Option<String>,
    preview_url: Option<String>,
    source: String,
    source_generation_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PromptPolishRequest {
    provider_id: String,
    model_id: String,
    prompt: String,
    mode_id: String,
    language: String,
    strength: String,
    protocol: Option<String>,
    base_url: Option<String>,
    extra_headers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
struct PromptPolishResult {
    provider_id: String,
    model_id: String,
    prompt: String,
    polished_prompt: String,
    raw: serde_json::Value,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct ListModelsRequest {
    provider_id: String,
    base_url: String,
    extra_headers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
struct ModelInfo {
    id: String,
    owned_by: Option<String>,
}

#[derive(Debug, Serialize)]
struct AppPaths {
    app_data_dir: String,
    library_dir: String,
    backups_dir: String,
    history_file: String,
}

#[derive(Debug, Deserialize)]
struct StorageSettingsRequest {
    library_dir_override: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
struct StoredStorageSettings {
    library_dir_override: Option<String>,
}

#[derive(Debug, Serialize)]
struct StorageSettings {
    library_dir_override: Option<String>,
    default_library_dir: String,
    resolved_library_dir: String,
    settings_file: String,
}

#[derive(Debug, Deserialize)]
struct SettingsBackupRequest {
    app_settings: Value,
    provider_configs: Value,
}

#[derive(Debug, Serialize)]
struct SettingsBackupResult {
    path: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct DeleteGenerationRecordResult {
    id: String,
    deleted: bool,
}

#[derive(Debug, Serialize)]
struct ImageGenerationResult {
    id: String,
    provider_id: String,
    model_id: String,
    status: String,
    prompt: String,
    image_urls: Vec<String>,
    local_image_paths: Vec<String>,
    cost_hint: Option<String>,
    duration_ms: Option<u128>,
    error: Option<String>,
    raw: serde_json::Value,
    created_at: String,
    generation_mode: Option<String>,
    reference_images: Option<Vec<ReferenceImage>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct GenerationRecord {
    id: String,
    provider_id: String,
    provider_name: Option<String>,
    model_id: String,
    status: String,
    prompt: String,
    image_urls: Vec<String>,
    local_image_paths: Vec<String>,
    cost_hint: Option<String>,
    duration_ms: Option<u128>,
    error: Option<String>,
    raw: serde_json::Value,
    created_at: String,
    saved_at: Option<String>,
    generation_mode: Option<String>,
    reference_images: Option<Vec<ReferenceImage>>,
}

fn secret_entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("provider:{provider_id}"))
        .map_err(|error| format!("Cannot open secure credential store: {error}"))
}

#[tauri::command]
fn save_provider_secret(request: SaveSecretRequest) -> Result<SecretStatus, String> {
    if request.secret.trim().is_empty() {
        return Err("API Key cannot be empty.".to_string());
    }

    let entry = secret_entry(&request.provider_id)?;
    entry
        .set_password(request.secret.trim())
        .map_err(|error| format!("Cannot save API Key securely: {error}"))?;

    Ok(SecretStatus {
        provider_id: request.provider_id,
        available: true,
    })
}

#[tauri::command]
fn get_provider_secret_status(provider_id: String) -> Result<SecretStatus, String> {
    let entry = secret_entry(&provider_id)?;
    let available = entry.get_password().map(|secret| !secret.is_empty()).unwrap_or(false);
    Ok(SecretStatus {
        provider_id,
        available,
    })
}

#[tauri::command]
fn delete_provider_secret(provider_id: String) -> Result<SecretStatus, String> {
    let entry = secret_entry(&provider_id)?;
    let _ = entry.delete_password();
    Ok(SecretStatus {
        provider_id,
        available: false,
    })
}

#[tauri::command]
async fn generate_openai_image(
    app: tauri::AppHandle,
    request: OpenAIImageRequest,
) -> Result<ImageGenerationResult, String> {
    let started = std::time::Instant::now();
    let api_key = secret_entry(&request.provider_id)?
        .get_password()
        .map_err(|_| "OpenAI API Key is not configured. Save it in Provider settings first.".to_string())?;

    let protocol = request.protocol.as_deref().unwrap_or("images").to_string();
    let generation_mode = request
        .generation_mode
        .clone()
        .unwrap_or_else(|| "text-to-image".to_string());
    let reference_images = request.reference_images.clone().unwrap_or_default();
    let is_image_to_image = generation_mode == "image-to-image" && !reference_images.is_empty();
    let mut endpoint_path = normalize_endpoint_path(
        request.endpoint_path.as_deref(),
        protocol.as_str(),
    )?;
    let use_openai_images_edit =
        request.provider_id == "openai-gpt-image" && protocol == "images" && is_image_to_image;
    if use_openai_images_edit && endpoint_path == "/v1/images/generations" {
        endpoint_path = "/v1/images/edits".to_string();
    }

    let base_url = normalize_base_url(
        request
            .base_url
            .as_deref()
            .unwrap_or("https://api.openai.com"),
    )?;

    let endpoint = format!("{base_url}{endpoint_path}");
    let client = reqwest::Client::new();
    let mut builder = client.post(endpoint).bearer_auth(api_key);

    if use_openai_images_edit {
        let form = build_openai_images_edit_form(&client, &request, &reference_images).await?;
        builder = builder.multipart(form);
    } else {
        let payload = build_openai_compatible_payload(&request, protocol.as_str());
        builder = builder.json(&payload);
    }

    if let Some(headers) = request.extra_headers.clone() {
        for (name, value) in headers {
            if name.eq_ignore_ascii_case("authorization") || name.eq_ignore_ascii_case("content-type") {
                continue;
            }
            builder = builder.header(name, value);
        }
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("OpenAI request failed: {error}"))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("Cannot read OpenAI-compatible response body: {error}"))?;
    let raw: serde_json::Value = match serde_json::from_str(&body_text) {
        Ok(raw) => raw,
        Err(parse_error) => {
            let preview: String = body_text.chars().take(600).collect();
            return Ok(ImageGenerationResult {
                id: format!("openai-{}", chrono_like_timestamp_millis()),
                provider_id: request.provider_id,
                model_id: request.model_id,
                status: "failed".to_string(),
                prompt: request.prompt,
                image_urls: Vec::new(),
                local_image_paths: Vec::new(),
                cost_hint: Some("未产生有效图片，通常不会按成功图片计费；以中转站/供应商账单为准".to_string()),
                duration_ms: Some(started.elapsed().as_millis()),
                error: Some(format_openai_compatible_error(
                    status.as_u16(),
                    None,
                    Some(&preview),
                    Some(&parse_error.to_string()),
                )),
                raw: serde_json::json!({
                    "http_status": status.as_u16(),
                    "parse_error": parse_error.to_string(),
                    "body_preview": preview
                }),
                created_at: chrono_like_timestamp(),
                generation_mode: Some(generation_mode),
                reference_images: Some(reference_images),
            });
        }
    };

    let image_urls = extract_image_urls(&raw);
    let local_image_paths = if status.is_success() && !image_urls.is_empty() {
        save_images_to_library(&app, &image_urls, &request.provider_id, &request.model_id)
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let display_image_urls = display_image_urls_for_paths(&app, &local_image_paths, &image_urls);

    let error = if status.is_success() && !image_urls.is_empty() {
        None
    } else {
        Some(format_openai_compatible_error(
            status.as_u16(),
            extract_error_message(&raw).as_deref(),
            None,
            None,
        ))
    };

    Ok(ImageGenerationResult {
        id: format!("openai-{}", chrono_like_timestamp_millis()),
        provider_id: request.provider_id,
        model_id: request.model_id,
        status: if error.is_some() { "failed" } else { "succeeded" }.to_string(),
        prompt: request.prompt,
        image_urls: display_image_urls,
        local_image_paths,
        cost_hint: Some("以 OpenAI 实际账单为准".to_string()),
        duration_ms: Some(started.elapsed().as_millis()),
        error,
        raw,
        created_at: chrono_like_timestamp(),
        generation_mode: Some(generation_mode),
        reference_images: Some(reference_images),
    })
}

#[tauri::command]
async fn list_openai_compatible_models(request: ListModelsRequest) -> Result<Vec<ModelInfo>, String> {
    let api_key = secret_entry(&request.provider_id)?
        .get_password()
        .map_err(|_| "API Key is not configured. Save it first.".to_string())?;
    let base_url = normalize_base_url(&request.base_url)?;
    let endpoint = format!("{base_url}/v1/models");

    let client = reqwest::Client::new();
    let mut builder = client.get(endpoint).bearer_auth(api_key);
    if let Some(headers) = request.extra_headers {
        for (name, value) in headers {
            if name.eq_ignore_ascii_case("authorization") || name.eq_ignore_ascii_case("content-type") {
                continue;
            }
            builder = builder.header(name, value);
        }
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("Cannot request model list: {error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("Cannot read model list response: {error}"))?;
    let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
        let preview: String = body_text.chars().take(600).collect();
        format!("Cannot parse model list as JSON: {error}. HTTP {status}. Body preview: {preview}")
    })?;

    if !status.is_success() {
        let message = raw
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(|message| message.as_str())
            .unwrap_or("Model list request failed.");
        return Err(format!("HTTP {status}: {message}"));
    }

    let data = raw
        .get("data")
        .and_then(|data| data.as_array())
        .ok_or_else(|| "Model list response does not contain data array.".to_string())?;

    Ok(data
        .iter()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?.to_string();
            let owned_by = item
                .get("owned_by")
                .and_then(|owned_by| owned_by.as_str())
                .map(|owned_by| owned_by.to_string());
            Some(ModelInfo { id, owned_by })
        })
        .collect())
}

#[tauri::command]
async fn polish_prompt_with_provider(request: PromptPolishRequest) -> Result<PromptPolishResult, String> {
    if request.prompt.trim().is_empty() {
        return Err("请先输入要润色的提示词。".to_string());
    }
    if request.model_id.trim().is_empty() {
        return Err("请先在偏好设置里选择提示词润色模型。".to_string());
    }

    let api_key = secret_entry(&request.provider_id)?
        .get_password()
        .map_err(|_| "API Key 未配置：请先到「平台接入」保存该平台的 API Key。".to_string())?;
    let base_url = normalize_base_url(
        request
            .base_url
            .as_deref()
            .unwrap_or("https://api.openai.com"),
    )?;
    let protocol = request.protocol.as_deref().unwrap_or("chat-completions");
    let endpoint_path = match protocol {
        "responses" => "/v1/responses",
        "chat-completions" => "/v1/chat/completions",
        other => return Err(format!("提示词润色暂不支持协议：{other}")),
    };
    let endpoint = format!("{base_url}{endpoint_path}");
    let instruction = build_prompt_polish_instruction(&request);
    let payload = build_prompt_polish_payload(&request, protocol, &instruction);

    let client = reqwest::Client::new();
    let mut builder = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&payload);

    if let Some(headers) = request.extra_headers {
        for (name, value) in headers {
            if name.eq_ignore_ascii_case("authorization") || name.eq_ignore_ascii_case("content-type") {
                continue;
            }
            builder = builder.header(name, value);
        }
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("提示词润色请求失败：{error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("无法读取提示词润色响应：{error}"))?;
    let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
        let preview: String = body_text.chars().take(600).collect();
        format!("提示词润色响应不是 JSON：{error}. HTTP {status}. 响应预览：{preview}")
    })?;

    if !status.is_success() {
        return Err(format_prompt_polish_error(
            status.as_u16(),
            extract_error_message(&raw).as_deref(),
        ));
    }

    let polished_prompt = extract_text_response(&raw)
        .ok_or_else(|| "模型已返回，但没有找到可用文本内容；已自动保留本地润色兜底。".to_string())?;

    Ok(PromptPolishResult {
        provider_id: request.provider_id,
        model_id: request.model_id,
        prompt: request.prompt,
        polished_prompt: polished_prompt.trim().trim_matches('"').trim().to_string(),
        raw,
        created_at: chrono_like_timestamp(),
    })
}

#[tauri::command]
fn load_generation_history(app: tauri::AppHandle) -> Result<Vec<GenerationRecord>, String> {
    let mut records = read_generation_history_records(&app)?;
    for record in &mut records {
        hydrate_record_image_urls(&app, record);
    }
    Ok(records)
}

fn read_generation_history_records(app: &tauri::AppHandle) -> Result<Vec<GenerationRecord>, String> {
    let path = history_file_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read generation history: {error}"))?;
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut records: Vec<GenerationRecord> = serde_json::from_str(&text)
        .map_err(|error| format!("Cannot parse generation history: {error}"))?;
    records.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(records)
}

#[tauri::command]
fn save_generation_record(
    app: tauri::AppHandle,
    mut record: GenerationRecord,
) -> Result<GenerationRecord, String> {
    let mut records = read_generation_history_records(&app)?;
    record.saved_at = Some(chrono_like_timestamp());
    if !record.local_image_paths.is_empty() {
        record.image_urls.retain(|url| !url.starts_with("data:image/"));
    }
    records.retain(|item| item.id != record.id);
    records.insert(0, record.clone());
    records.truncate(500);
    write_generation_history(&app, &records)?;

    hydrate_record_image_urls(&app, &mut record);
    Ok(record)
}

#[tauri::command]
fn delete_generation_record(
    app: tauri::AppHandle,
    record_id: String,
) -> Result<DeleteGenerationRecordResult, String> {
    let record_id = record_id.trim().to_string();
    if record_id.is_empty() {
        return Err("Generation record id cannot be empty.".to_string());
    }

    let mut records = read_generation_history_records(&app)?;
    let before_len = records.len();
    records.retain(|item| item.id != record_id);
    let deleted = records.len() != before_len;
    if deleted {
        write_generation_history(&app, &records)?;
    }

    Ok(DeleteGenerationRecordResult { id: record_id, deleted })
}
#[tauri::command]
fn reveal_generation_file(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    let reveal_path = if target.is_file() {
        target
            .parent()
            .map(|path| path.to_path_buf())
            .unwrap_or(target)
    } else {
        target
    };

    open_path_in_file_manager(reveal_path)
}

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> Result<AppPaths, String> {
    let app_data_dir = app_data_dir(&app)?;
    let library_dir = library_dir(&app)?;
    let backups_dir = backups_dir(&app)?;
    let history_file = history_file_path(&app)?;

    Ok(AppPaths {
        app_data_dir: path_to_user_string(&app_data_dir),
        library_dir: path_to_user_string(&library_dir),
        backups_dir: path_to_user_string(&backups_dir),
        history_file: path_to_user_string(&history_file),
    })
}

#[tauri::command]
fn reveal_app_data_dir(app: tauri::AppHandle) -> Result<(), String> {
    open_path_in_file_manager(app_data_dir(&app)?)
}

#[tauri::command]
fn reveal_library_dir(app: tauri::AppHandle) -> Result<(), String> {
    open_path_in_file_manager(library_dir(&app)?)
}

#[tauri::command]
fn get_storage_settings(app: tauri::AppHandle) -> Result<StorageSettings, String> {
    storage_settings_response(&app)
}

#[tauri::command]
fn save_storage_settings(
    app: tauri::AppHandle,
    request: StorageSettingsRequest,
) -> Result<StorageSettings, String> {
    save_library_dir_override(&app, request.library_dir_override.as_deref())
}

#[tauri::command]
fn choose_library_dir(app: tauri::AppHandle) -> Result<Option<StorageSettings>, String> {
    let current_dir = library_dir(&app)?;
    let selected_dir = pick_folder_with_system_dialog(&current_dir)?;
    match selected_dir {
        Some(path) => save_library_dir_override(&app, Some(path.to_string_lossy().as_ref())).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("https://") || trimmed.starts_with("http://")) {
        return Err("Only http/https URLs can be opened externally.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", trimmed])
            .spawn()
            .map_err(|error| format!("Failed to open URL: {error}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(trimmed)
            .spawn()
            .map_err(|error| format!("Failed to open URL: {error}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|error| format!("Failed to open URL: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn export_settings_backup(
    app: tauri::AppHandle,
    request: SettingsBackupRequest,
) -> Result<SettingsBackupResult, String> {
    let created_at = chrono_like_timestamp();
    let backups_dir = backups_dir(&app)?;
    let history = read_generation_history_records(&app).unwrap_or_default();
    let filename = format!("visionhub-settings-backup-{}.json", chrono_like_timestamp_millis());
    let path = backups_dir.join(filename);
    let payload = serde_json::json!({
        "schema": "visionhub-settings-backup/v1",
        "version": "0.1.0",
        "created_at": created_at,
        "app_settings": request.app_settings,
        "provider_configs": request.provider_configs,
        "generation_history": history,
        "notes": {
            "api_keys": "API keys are stored in the system credential store and are intentionally not exported."
        }
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Cannot serialize settings backup: {error}"))?;
    std::fs::write(&path, text)
        .map_err(|error| format!("Cannot write settings backup: {error}"))?;

    Ok(SettingsBackupResult {
        path: path_to_user_string(&path),
        created_at,
    })
}

fn normalize_base_url(base_url: &str) -> Result<String, String> {
    let base_url = base_url.trim().trim_end_matches('/').to_string();
    if !(base_url.starts_with("https://")
        || base_url.starts_with("http://127.0.0.1")
        || base_url.starts_with("http://localhost"))
    {
        return Err(
            "Base URL must be HTTPS, or local http://127.0.0.1 / http://localhost for local testing."
                .to_string(),
        );
    }
    Ok(base_url)
}

fn extract_error_message(raw: &Value) -> Option<String> {
    raw.get("error")
        .and_then(|error| {
            error
                .get("message")
                .and_then(|message| message.as_str())
                .or_else(|| error.as_str())
        })
        .map(|message| message.to_string())
        .or_else(|| {
            raw.get("message")
                .and_then(|message| message.as_str())
                .map(|message| message.to_string())
        })
}

fn format_openai_compatible_error(
    status_code: u16,
    json_message: Option<&str>,
    body_preview: Option<&str>,
    parse_error: Option<&str>,
) -> String {
    let prefix = match status_code {
        401 => "认证失败：API Key 无效、过期，或中转站没有接受当前密钥。",
        403 => "权限不足：当前 Key/账号可能没有该模型或图片接口权限。",
        404 => "接口不存在：请检查 Base URL、协议类型和接口路径。",
        408 | 524 => "请求超时：中转站或上游生图服务等待太久后断开。",
        429 => "请求受限：可能是余额不足、频率限制或并发限制。",
        500..=599 => "供应商/中转站服务异常：上游没有正常返回生图结果。",
        _ => "生图接口没有返回有效图片。",
    };

    let mut parts = vec![format!("{prefix} HTTP {status_code}.")];
    if let Some(message) = json_message.filter(|message| !message.trim().is_empty()) {
        parts.push(format!("返回信息：{message}"));
    }
    if let Some(parse_error) = parse_error {
        parts.push(format!("响应不是 JSON：{parse_error}"));
    }
    if let Some(preview) = body_preview.filter(|preview| !preview.trim().is_empty()) {
        parts.push(format!("响应预览：{preview}"));
    }
    parts.push("你不需要重新配置；如果模型和 Base URL 没变，建议直接重试，或在 Provider Hub 切换 Responses/Images 协议、降低数量后再试。".to_string());
    parts.join(" ")
}

fn build_prompt_polish_instruction(request: &PromptPolishRequest) -> String {
    let language = match request.language.as_str() {
        "en" => "输出英文提示词。",
        "bilingual" => "输出中英双语提示词，先中文后英文。",
        _ => "保持中文输出。",
    };
    let strength = match request.strength.as_str() {
        "concise" => "简洁增强：只补充必要的主体、构图和风格关键词。",
        "detailed" => "细节扩写：补充主体、场景、材质、光线、构图、镜头和氛围。",
        "cinematic" => "电影感：强化镜头语言、光影、景深、画面叙事和氛围。",
        "commercial" => "商业摄影：强化产品/主体质感、干净背景、品牌感、灯光和可交付性。",
        _ => "专业生图提示词：整理成适合 AI 图像生成的完整提示词。",
    };
    let mode = match request.mode_id.as_str() {
        "cinematic" => "当前弹窗模式偏向电影感润色。",
        "commercial" => "当前弹窗模式偏向商业视觉润色。",
        "platform-cn" => "当前弹窗模式偏向中文平台更易理解的描述。",
        _ => "当前弹窗模式偏向补全细节。",
    };

    format!(
        "你是专业 AI 图像提示词编辑器。请润色用户提示词，使其更适合文生图/图生图。要求：{language}{strength}{mode} 只输出润色后的提示词，不要解释，不要 Markdown，不要加标题。"
    )
}

fn build_prompt_polish_payload(request: &PromptPolishRequest, protocol: &str, instruction: &str) -> Value {
    let user_content = format!("原始提示词：\n{}", request.prompt.trim());
    match protocol {
        "responses" => serde_json::json!({
            "model": request.model_id,
            "input": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": user_content }
            ],
            "temperature": 0.4
        }),
        _ => serde_json::json!({
            "model": request.model_id,
            "messages": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": user_content }
            ],
            "temperature": 0.4
        }),
    }
}

fn extract_text_response(raw: &Value) -> Option<String> {
    if let Some(text) = raw.get("output_text").and_then(|value| value.as_str()) {
        return Some(text.to_string());
    }
    if let Some(text) = raw
        .get("choices")
        .and_then(|choices| choices.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
    {
        return Some(text.to_string());
    }
    if let Some(text) = raw
        .get("choices")
        .and_then(|choices| choices.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("text"))
        .and_then(|text| text.as_str())
    {
        return Some(text.to_string());
    }
    if let Some(output) = raw.get("output").and_then(|output| output.as_array()) {
        for item in output {
            if let Some(content) = item.get("content").and_then(|content| content.as_array()) {
                for part in content {
                    if let Some(text) = part.get("text").and_then(|text| text.as_str()) {
                        return Some(text.to_string());
                    }
                }
            }
        }
    }
    None
}

fn format_prompt_polish_error(status_code: u16, json_message: Option<&str>) -> String {
    let prefix = match status_code {
        401 => "认证失败：API Key 无效或未被中转站接受。",
        403 => "权限不足：当前 Key/账号可能没有文本模型权限。",
        404 => "接口不存在：请检查 Base URL 或润色协议。",
        429 => "请求受限：可能是余额不足、频率限制或并发限制。",
        500..=599 => "供应商/中转站服务异常。",
        _ => "提示词润色接口请求失败。",
    };
    match json_message.filter(|message| !message.trim().is_empty()) {
        Some(message) => format!("{prefix} HTTP {status_code}. 返回信息：{message}"),
        None => format!("{prefix} HTTP {status_code}."),
    }
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot resolve app data directory: {error}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create app data directory: {error}"))?;
    Ok(dir)
}

fn default_library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("library"))
}

fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = read_storage_settings(app)?;
    let dir = match settings
        .library_dir_override
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => resolve_library_override(path)?,
        None => default_library_dir(app)?,
    };
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create local image library: {error}"))?;
    Ok(dir)
}

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("backups");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create backups directory: {error}"))?;
    Ok(dir)
}

fn history_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("generation-history.json"))
}

fn storage_settings_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("storage-settings.json"))
}

fn read_storage_settings(app: &tauri::AppHandle) -> Result<StoredStorageSettings, String> {
    let path = storage_settings_file_path(app)?;
    if !path.exists() {
        return Ok(StoredStorageSettings::default());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read storage settings: {error}"))?;
    if text.trim().is_empty() {
        return Ok(StoredStorageSettings::default());
    }
    serde_json::from_str(&text).map_err(|error| format!("Cannot parse storage settings: {error}"))
}

fn write_storage_settings(
    app: &tauri::AppHandle,
    settings: &StoredStorageSettings,
) -> Result<(), String> {
    let path = storage_settings_file_path(app)?;
    let text = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Cannot serialize storage settings: {error}"))?;
    std::fs::write(&path, text)
        .map_err(|error| format!("Cannot write storage settings: {error}"))?;
    Ok(())
}

fn storage_settings_response(app: &tauri::AppHandle) -> Result<StorageSettings, String> {
    let stored = read_storage_settings(app)?;
    let default_library_dir = default_library_dir(app)?;
    let resolved_library_dir = library_dir(app)?;
    let settings_file = storage_settings_file_path(app)?;

    Ok(StorageSettings {
        library_dir_override: stored
            .library_dir_override
            .as_deref()
            .map(strip_windows_extended_path_prefix),
        default_library_dir: path_to_user_string(&default_library_dir),
        resolved_library_dir: path_to_user_string(&resolved_library_dir),
        settings_file: path_to_user_string(&settings_file),
    })
}

fn save_library_dir_override(
    app: &tauri::AppHandle,
    override_path: Option<&str>,
) -> Result<StorageSettings, String> {
    let override_path = override_path.map(str::trim).filter(|value| !value.is_empty());
    let stored = StoredStorageSettings {
        library_dir_override: match override_path {
            Some(path) => Some(path_to_user_string(&resolve_library_override(path)?)),
            None => None,
        },
    };
    write_storage_settings(app, &stored)?;
    storage_settings_response(app)
}

fn resolve_library_override(path: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(path.trim());
    if !dir.is_absolute() {
        return Err("图库目录必须是绝对路径，例如 D:\\VisionHub\\library。".to_string());
    }
    if dir.is_file() {
        return Err("图库目录不能指向一个文件，请选择文件夹。".to_string());
    }
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create custom library directory: {error}"))?;
    dir.canonicalize()
        .map_err(|error| format!("Cannot resolve custom library directory: {error}"))
}

fn path_to_user_string(path: &Path) -> String {
    strip_windows_extended_path_prefix(&path.to_string_lossy())
}

fn strip_windows_extended_path_prefix(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = path.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        path.to_string()
    }
}

fn pick_folder_with_system_dialog(initial_dir: &Path) -> Result<Option<PathBuf>, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = initial_dir;

        const BIF_RETURNONLYFSDIRS: u32 = 0x0001;
        const BIF_NEWDIALOGSTYLE: u32 = 0x0040;
        const MAX_PATH_WIDE: usize = 32768;

        #[repr(C)]
        struct BrowseInfoW {
            hwnd_owner: *mut c_void,
            pidl_root: *const c_void,
            psz_display_name: *mut u16,
            lpsz_title: *const u16,
            ul_flags: u32,
            lpfn: Option<unsafe extern "system" fn(*mut c_void, u32, isize, isize) -> i32>,
            l_param: isize,
            i_image: i32,
        }

        #[link(name = "shell32")]
        unsafe extern "system" {
            fn SHBrowseForFolderW(lpbi: *mut BrowseInfoW) -> *mut c_void;
            fn SHGetPathFromIDListW(pidl: *const c_void, psz_path: *mut u16) -> i32;
        }

        #[link(name = "ole32")]
        unsafe extern "system" {
            fn CoTaskMemFree(pv: *mut c_void);
        }

        let mut display_name = [0u16; 260];
        let title: Vec<u16> = "选择 VisionHub Studio 本地图库目录\0"
            .encode_utf16()
            .collect();
        let mut browse_info = BrowseInfoW {
            hwnd_owner: std::ptr::null_mut(),
            pidl_root: std::ptr::null(),
            psz_display_name: display_name.as_mut_ptr(),
            lpsz_title: title.as_ptr(),
            ul_flags: BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE,
            lpfn: None,
            l_param: 0,
            i_image: 0,
        };

        let pidl = unsafe { SHBrowseForFolderW(&mut browse_info) };
        if pidl.is_null() {
            return Ok(None);
        }

        let mut path_buffer = vec![0u16; MAX_PATH_WIDE];
        let ok = unsafe { SHGetPathFromIDListW(pidl, path_buffer.as_mut_ptr()) };
        unsafe { CoTaskMemFree(pidl) };
        if ok == 0 {
            return Err("Cannot resolve selected folder path.".to_string());
        }

        let len = path_buffer
            .iter()
            .position(|item| *item == 0)
            .unwrap_or(path_buffer.len());
        if len == 0 {
            return Ok(None);
        }

        Ok(Some(PathBuf::from(String::from_utf16_lossy(&path_buffer[..len]))))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = initial_dir;
        Err("当前平台暂未接入系统文件夹选择窗口。".to_string())
    }
}

fn open_path_in_file_manager(path: PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        shell_execute_open_path(&path)?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Cannot open folder: {error}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Cannot open folder: {error}"))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn shell_execute_open_path(path: &Path) -> Result<(), String> {
    #[link(name = "shell32")]
    unsafe extern "system" {
        fn ShellExecuteW(
            hwnd: *mut c_void,
            lp_operation: *const u16,
            lp_file: *const u16,
            lp_parameters: *const u16,
            lp_directory: *const u16,
            n_show_cmd: i32,
        ) -> isize;
    }

    const SW_SHOWNORMAL: i32 = 1;
    let operation: Vec<u16> = "open\0".encode_utf16().collect();
    let target: Vec<u16> = path_to_user_string(path)
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };

    if result <= 32 {
        Err(format!("Cannot open folder. Windows ShellExecuteW error code: {result}"))
    } else {
        Ok(())
    }
}

fn write_generation_history(
    app: &tauri::AppHandle,
    records: &[GenerationRecord],
) -> Result<(), String> {
    let path = history_file_path(app)?;
    let tmp_path = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(records)
        .map_err(|error| format!("Cannot serialize generation history: {error}"))?;
    std::fs::write(&tmp_path, text)
        .map_err(|error| format!("Cannot write generation history: {error}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Cannot replace generation history: {error}"))?;
    Ok(())
}

fn hydrate_record_image_urls(app: &tauri::AppHandle, record: &mut GenerationRecord) {
    if record.local_image_paths.is_empty() {
        return;
    }

    let image_urls = display_image_urls_for_paths(app, &record.local_image_paths, &record.image_urls);
    if !image_urls.is_empty() {
        record.image_urls = image_urls;
    }
}

fn display_image_urls_for_paths(
    app: &tauri::AppHandle,
    local_paths: &[String],
    fallback_urls: &[String],
) -> Vec<String> {
    if local_paths.is_empty() {
        return fallback_urls.to_vec();
    }

    let display_urls: Vec<String> = local_paths
        .iter()
        .filter_map(|path| local_image_path_to_data_url(app, path).ok())
        .collect();

    if display_urls.is_empty() {
        fallback_urls.to_vec()
    } else {
        display_urls
    }
}

fn local_image_path_to_data_url(app: &tauri::AppHandle, path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    if !is_allowed_library_image_path(app, &file_path)? {
        return Err("Image path is outside the current VisionHub library scope.".to_string());
    }

    let bytes = std::fs::read(&file_path)
        .map_err(|error| format!("Cannot read generated image: {error}"))?;
    let mime = image_mime_from_path(&file_path);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

fn is_allowed_library_image_path(app: &tauri::AppHandle, path: &Path) -> Result<bool, String> {
    let file = path
        .canonicalize()
        .map_err(|error| format!("Cannot resolve generated image path: {error}"))?;
    if !file.is_file() {
        return Ok(false);
    }

    let roots = [default_library_dir(app)?, library_dir(app)?];
    for root in roots {
        std::fs::create_dir_all(&root)
            .map_err(|error| format!("Cannot create library scope directory: {error}"))?;
        let root = root
            .canonicalize()
            .map_err(|error| format!("Cannot resolve library scope directory: {error}"))?;
        if file.starts_with(root) {
            return Ok(true);
        }
    }

    Ok(false)
}

fn image_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "image/png",
    }
}

async fn save_images_to_library(
    app: &tauri::AppHandle,
    image_urls: &[String],
    provider_id: &str,
    model_id: &str,
) -> Result<Vec<String>, String> {
    let dir = library_dir(app)?;
    let client = reqwest::Client::new();
    let mut saved_paths = Vec::new();

    for (index, image_url) in image_urls.iter().enumerate() {
        let (bytes, extension) = if image_url.starts_with("data:image/") {
            decode_data_url_image(image_url)?
        } else if image_url.starts_with("http://") || image_url.starts_with("https://") {
            download_remote_image(&client, image_url).await?
        } else {
            continue;
        };

        let filename = format!(
            "{}-{}-{}-{}.{}",
            chrono_like_timestamp_millis(),
            sanitize_filename(provider_id),
            sanitize_filename(model_id),
            index + 1,
            extension
        );
        let path = dir.join(filename);
        std::fs::write(&path, bytes)
            .map_err(|error| format!("Cannot save generated image: {error}"))?;
        saved_paths.push(path_to_user_string(&path));
    }

    Ok(saved_paths)
}

fn decode_data_url_image(data_url: &str) -> Result<(Vec<u8>, String), String> {
    let (header, payload) = data_url
        .split_once(',')
        .ok_or_else(|| "Invalid data URL image payload.".to_string())?;
    let extension = if header.contains("image/jpeg") || header.contains("image/jpg") {
        "jpg"
    } else if header.contains("image/webp") {
        "webp"
    } else if header.contains("image/svg+xml") {
        "svg"
    } else {
        "png"
    };

    let bytes = if header.contains(";base64") {
        base64::engine::general_purpose::STANDARD
            .decode(payload)
            .map_err(|error| format!("Cannot decode base64 image: {error}"))?
    } else {
        percent_decode(payload)
    };

    Ok((bytes, extension.to_string()))
}

async fn download_remote_image(
    client: &reqwest::Client,
    image_url: &str,
) -> Result<(Vec<u8>, String), String> {
    let response = client
        .get(image_url)
        .send()
        .await
        .map_err(|error| format!("Cannot download generated image: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Cannot download generated image. HTTP {status}"));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let extension = extension_from_content_type(&content_type);
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Cannot read generated image bytes: {error}"))?
        .to_vec();
    Ok((bytes, extension))
}

fn extension_from_content_type(content_type: &str) -> String {
    if content_type.contains("jpeg") || content_type.contains("jpg") {
        "jpg".to_string()
    } else if content_type.contains("webp") {
        "webp".to_string()
    } else if content_type.contains("svg") {
        "svg".to_string()
    } else {
        "png".to_string()
    }
}

fn sanitize_filename(input: &str) -> String {
    let mut output: String = input
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() || char == '-' || char == '_' {
                char
            } else {
                '-'
            }
        })
        .collect();
    output.truncate(48);
    output.trim_matches('-').to_string()
}

fn percent_decode(input: &str) -> Vec<u8> {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[index + 1..index + 3]) {
                if let Ok(value) = u8::from_str_radix(hex, 16) {
                    output.push(value);
                    index += 3;
                    continue;
                }
            }
        }
        output.push(bytes[index]);
        index += 1;
    }
    output
}

fn normalize_endpoint_path(custom_path: Option<&str>, protocol: &str) -> Result<String, String> {
    let default_path = match protocol {
        "images" => "/v1/images/generations",
        "responses" => "/v1/responses",
        "chat-completions" => "/v1/chat/completions",
        "custom-images" => custom_path.unwrap_or("/v1/images/generations"),
        other => return Err(format!("Unsupported protocol: {other}")),
    };

    let path = custom_path.unwrap_or(default_path).trim();
    if path.is_empty() {
        return Err("Endpoint path cannot be empty.".to_string());
    }
    if path.starts_with("http://") || path.starts_with("https://") {
        return Err("Endpoint path must be a path like /v1/images/generations, not a full URL.".to_string());
    }
    Ok(if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    })
}

async fn build_openai_images_edit_form(
    client: &reqwest::Client,
    request: &OpenAIImageRequest,
    references: &[ReferenceImage],
) -> Result<reqwest::multipart::Form, String> {
    if references.is_empty() {
        return Err("图生图需要先添加至少一张参考图。".to_string());
    }

    let mut form = reqwest::multipart::Form::new()
        .text("model", request.model_id.clone())
        .text("prompt", request.prompt.clone())
        .text("size", request.size.clone())
        .text("n", request.count.max(1).min(4).to_string());

    if let Some(quality) = request.quality.as_ref().filter(|quality| !quality.trim().is_empty()) {
        form = form.text("quality", quality.clone());
    }

    for (index, reference) in references.iter().enumerate() {
        let image_url = reference
            .data_url
            .as_deref()
            .or(reference.preview_url.as_deref())
            .ok_or_else(|| "参考图没有可用的图片数据。".to_string())?;
        let (bytes, extension) = if image_url.starts_with("data:image/") {
            decode_data_url_image(image_url)?
        } else if image_url.starts_with("http://") || image_url.starts_with("https://") {
            download_remote_image(client, image_url).await?
        } else {
            return Err("参考图格式不受支持，请重新选择本地图片。".to_string());
        };
        let file_name = reference
            .name
            .clone()
            .unwrap_or_else(|| format!("reference-{}.{}", index + 1, extension));
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(file_name)
            .mime_str(mime_from_extension(&extension))
            .map_err(|error| format!("Cannot attach reference image: {error}"))?;
        let field_name = if index == 0 { "image" } else { "image[]" };
        form = form.part(field_name, part);
    }

    Ok(form)
}

fn mime_from_extension(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
}

fn build_openai_compatible_payload(request: &OpenAIImageRequest, protocol: &str) -> Value {
    let reference_data_urls: Vec<String> = request
        .reference_images
        .as_ref()
        .map(|references| {
            references
                .iter()
                .filter_map(|reference| {
                    reference
                        .data_url
                        .as_deref()
                        .or(reference.preview_url.as_deref())
                        .filter(|url| url.starts_with("data:image/") || url.starts_with("http://") || url.starts_with("https://"))
                        .map(|url| url.to_string())
                })
                .collect()
        })
        .unwrap_or_default();
    let is_image_to_image = request
        .generation_mode
        .as_deref()
        .map(|mode| mode == "image-to-image")
        .unwrap_or(false)
        && !reference_data_urls.is_empty();

    match protocol {
        "responses" => {
            if is_image_to_image {
                let mut content = vec![serde_json::json!({
                    "type": "input_text",
                    "text": request.prompt
                })];
                for image_url in &reference_data_urls {
                    content.push(serde_json::json!({
                        "type": "input_image",
                        "image_url": image_url
                    }));
                }
                serde_json::json!({
                    "model": request.model_id,
                    "input": [{ "role": "user", "content": content }],
                    "tools": [{ "type": "image_generation" }],
                    "size": request.size,
                    "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string())
                })
            } else {
                serde_json::json!({
                    "model": request.model_id,
                    "input": request.prompt,
                    "tools": [{ "type": "image_generation" }],
                    "size": request.size,
                    "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string())
                })
            }
        }
        "chat-completions" => {
            if is_image_to_image {
                let mut content = vec![serde_json::json!({
                    "type": "text",
                    "text": request.prompt
                })];
                for image_url in &reference_data_urls {
                    content.push(serde_json::json!({
                        "type": "image_url",
                        "image_url": { "url": image_url }
                    }));
                }
                serde_json::json!({
                    "model": request.model_id,
                    "messages": [{ "role": "user", "content": content }],
                    "modalities": ["text", "image"],
                    "size": request.size,
                    "n": request.count.max(1).min(4)
                })
            } else {
                serde_json::json!({
                    "model": request.model_id,
                    "messages": [
                        {
                            "role": "user",
                            "content": request.prompt
                        }
                    ],
                    "modalities": ["text", "image"],
                    "size": request.size,
                    "n": request.count.max(1).min(4)
                })
            }
        }
        _ => {
            if is_image_to_image {
                serde_json::json!({
                    "model": request.model_id,
                    "prompt": request.prompt,
                    "image": reference_data_urls.first(),
                    "images": reference_data_urls,
                    "size": request.size,
                    "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                    "n": request.count.max(1).min(4)
                })
            } else {
                serde_json::json!({
                    "model": request.model_id,
                    "prompt": request.prompt,
                    "size": request.size,
                    "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                    "n": request.count.max(1).min(4)
                })
            }
        }
    }
}

fn extract_image_urls(raw: &Value) -> Vec<String> {
    let mut urls = Vec::new();
    collect_images_recursive(raw, &mut urls);
    urls
}

fn collect_images_recursive(value: &Value, urls: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for key in ["url", "image_url"] {
                if let Some(url) = map.get(key).and_then(|value| value.as_str()) {
                    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("data:image/") {
                        urls.push(url.to_string());
                    }
                }
            }
            for key in ["b64_json", "image_base64", "base64", "data"] {
                if let Some(b64) = map.get(key).and_then(|value| value.as_str()) {
                    if b64.len() > 128 && !b64.starts_with("http") && !b64.starts_with("data:") {
                        urls.push(format!("data:image/png;base64,{b64}"));
                    }
                }
            }
            for child in map.values() {
                collect_images_recursive(child, urls);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_images_recursive(item, urls);
            }
        }
        Value::String(text) => {
            if text.starts_with("data:image/") {
                urls.push(text.to_string());
            }
        }
        _ => {}
    }
}

fn chrono_like_timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn chrono_like_timestamp() -> String {
    format!("{}", chrono_like_timestamp_millis())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_provider_secret,
            get_provider_secret_status,
            delete_provider_secret,
            generate_openai_image,
            list_openai_compatible_models,
            polish_prompt_with_provider,
            load_generation_history,
            save_generation_record,
            delete_generation_record,
            reveal_generation_file,
            get_app_paths,
            reveal_app_data_dir,
            reveal_library_dir,
            get_storage_settings,
            save_storage_settings,
            choose_library_dir,
            open_external_url,
            export_settings_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running VisionHub Studio");
}

fn main() {
    run();
}

