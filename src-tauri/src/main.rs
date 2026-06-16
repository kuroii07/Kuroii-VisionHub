use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::webp::WebPEncoder;
use image::{ColorType, ImageEncoder};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Manager;

const KEYRING_SERVICE: &str = "visionhub-studio";

#[derive(Debug, Deserialize)]
struct SaveSecretRequest {
    provider_id: String,
    secret: String,
}

#[derive(Debug, Deserialize)]
struct SaveTextFileRequest {
    suggested_file_name: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct SaveTextFileResult {
    path: Option<String>,
    saved: bool,
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
    negative_prompt: Option<String>,
    size: String,
    quality: Option<String>,
    seed: Option<u64>,
    output_format: Option<String>,
    output_compression: Option<u8>,
    count: u8,
    generation_mode: Option<String>,
    reference_images: Option<Vec<ReferenceImage>>,
    base_url: Option<String>,
    protocol: Option<String>,
    image_to_image_adapter: Option<String>,
    endpoint_path: Option<String>,
    extra_headers: Option<std::collections::HashMap<String, String>>,
    secret_id: Option<String>,
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
    role: Option<String>,
    added_at: Option<String>,
}

#[derive(Debug, Clone)]
struct ImageToImageProtocolMapping {
    generation_mode: String,
    image_to_image_adapter: String,
    protocol: String,
    endpoint_path: String,
    request_shape: String,
    reference_count: usize,
    reference_roles: Vec<String>,
    reference_fields: Vec<String>,
    is_image_to_image: bool,
}

#[derive(Debug, Deserialize)]
struct PromptPolishRequest {
    provider_id: String,
    model_id: String,
    prompt: String,
    mode_id: String,
    style_id: Option<String>,
    language: String,
    strength: String,
    protocol: Option<String>,
    base_url: Option<String>,
    extra_headers: Option<std::collections::HashMap<String, String>>,
    secret_id: Option<String>,
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
    secret_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ComfyUIDiagnosisRequest {
    base_url: String,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ComfyUIGenerationRequest {
    base_url: String,
    workflow: Value,
    workflow_name: Option<String>,
    prompt: String,
    negative_prompt: Option<String>,
    size: String,
    seed: Option<u64>,
    output_format: Option<String>,
    output_compression: Option<u8>,
    count: Option<u8>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
struct ComfyUIDiagnosisEndpoint {
    path: String,
    ok: bool,
    status: Option<u16>,
    detail: String,
}

#[derive(Debug, Serialize)]
struct ComfyUIDiagnosisResult {
    base_url: String,
    resolved_base_url: String,
    checked_at: String,
    latency_ms: u128,
    online: bool,
    system_stats: Option<Value>,
    object_info_node_count: Option<usize>,
    queue_running: Option<usize>,
    queue_pending: Option<usize>,
    endpoints: Vec<ComfyUIDiagnosisEndpoint>,
    message: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct ComfyUIImageRef {
    filename: String,
    subfolder: String,
    image_type: String,
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
    library_meta_file: String,
}

#[derive(Debug, Deserialize)]
struct StorageSettingsRequest {
    library_dir_override: Option<String>,
    inspiration_dir_override: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReferenceImagesFromPathsRequest {
    paths: Vec<String>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
struct StoredStorageSettings {
    library_dir_override: Option<String>,
    inspiration_dir_override: Option<String>,
}

#[derive(Debug, Serialize)]
struct StorageSettings {
    library_dir_override: Option<String>,
    inspiration_dir_override: Option<String>,
    default_library_dir: String,
    resolved_library_dir: String,
    default_inspiration_dir: String,
    resolved_inspiration_dir: String,
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
struct ImportLibraryImagesResult {
    records: Vec<GenerationRecord>,
    skipped_duplicates: usize,
    skipped_unsupported: usize,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct LibraryData {
    #[serde(default = "library_data_version")]
    version: u32,
    #[serde(default)]
    exists: bool,
    #[serde(default = "empty_json_object")]
    meta: Value,
    #[serde(default = "empty_library_organization")]
    organization: Value,
    #[serde(default = "empty_json_object")]
    display_settings: Value,
    #[serde(default = "empty_json_array")]
    custom_quick_filters: Value,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct InspirationSource {
    id: String,
    name: String,
    url: String,
    category: String,
    region: String,
    source_kind: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    keywords: Vec<String>,
    note: Option<String>,
    scene_notes: Option<String>,
    membership_notes: Option<String>,
    copyright_notes: Option<String>,
    favicon_url: Option<String>,
    requires_login: Option<bool>,
    commercial_reference: String,
    open_count: Option<u32>,
    created_at: String,
    updated_at: String,
    last_opened_at: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct InspirationAsset {
    id: String,
    title: String,
    image_path: Option<String>,
    image_url: Option<String>,
    thumbnail_path: Option<String>,
    source_url: Option<String>,
    source_platform: Option<String>,
    author: Option<String>,
    original_prompt: Option<String>,
    inferred_prompt: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
    license_status: String,
    rating: Option<u8>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct InspirationLibrary {
    sources: Vec<InspirationSource>,
    assets: Vec<InspirationAsset>,
}

#[derive(Debug, Deserialize)]
struct InspirationAssetImportRequest {
    title: String,
    data_url: String,
    file_name: Option<String>,
    source_url: Option<String>,
    source_platform: Option<String>,
    author: Option<String>,
    original_prompt: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    note: Option<String>,
    license_status: Option<String>,
    rating: Option<u8>,
}

#[derive(Debug, Serialize)]
struct DeleteInspirationResult {
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

#[derive(Debug, Deserialize)]
struct RecheckBackgroundGenerationRequest {
    record_id: String,
    secret_id: Option<String>,
    extra_headers: Option<std::collections::HashMap<String, String>>,
}

fn secret_entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("provider:{provider_id}"))
        .map_err(|error| format!("Cannot open secure credential store: {error}"))
}

fn read_provider_secret(secret_id: Option<&str>, provider_id: &str) -> Result<String, String> {
    if let Some(secret_id) = secret_id.filter(|value| !value.trim().is_empty()) {
        if let Ok(secret) = secret_entry(secret_id)?.get_password() {
            if !secret.trim().is_empty() {
                return Ok(secret);
            }
        }
    }

    secret_entry(provider_id)?
        .get_password()
        .map_err(|error| format!("Cannot read API Key securely: {error}"))
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
    if request.provider_id == "minimax-image" {
        return generate_minimax_image(app, request).await;
    }

    let started = std::time::Instant::now();
    let api_key = read_provider_secret(request.secret_id.as_deref(), &request.provider_id)
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
    let mut protocol_mapping = resolve_image_to_image_protocol_mapping(
        &request,
        protocol.as_str(),
        &endpoint_path,
        &generation_mode,
        &reference_images,
    );
    let use_openai_images_edit = is_image_to_image
        && protocol_mapping.image_to_image_adapter == "openai-images-edit";
    if use_openai_images_edit && endpoint_path == "/v1/images/generations" {
        endpoint_path = "/v1/images/edits".to_string();
    }
    protocol_mapping.endpoint_path = endpoint_path.clone();

    let base_url = normalize_base_url(
        request
            .base_url
            .as_deref()
            .unwrap_or("https://api.openai.com"),
    )?;

    let endpoint = format!("{base_url}{endpoint_path}");
    let client = reqwest::Client::new();
    let mut builder = client.post(&endpoint).bearer_auth(&api_key);
    let mut request_payload: Option<Value> = None;
    let mut responses_background_requested = false;

    let api_size = normalize_openai_image_size_for_base_url(&base_url, &request.size);

    if use_openai_images_edit {
        let form = build_openai_images_edit_form(&client, &request, &reference_images, &api_size).await?;
        builder = builder.multipart(form);
    } else {
        let payload = build_openai_compatible_payload(&request, protocol.as_str(), &api_size, &protocol_mapping);
        responses_background_requested = protocol == "responses";
        request_payload = Some(payload.clone());
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

    let mut status = response.status();
    let mut body_text = response
        .text()
        .await
        .map_err(|error| format!("Cannot read OpenAI-compatible response body: {error}"))?;
    if responses_background_requested
        && !status.is_success()
        && response_body_mentions_background_unsupported(&body_text)
    {
        if let Some(payload) = request_payload.clone() {
            let sync_payload = without_responses_background(payload);
            let mut retry_builder = client.post(&endpoint).bearer_auth(&api_key).json(&sync_payload);
            if let Some(headers) = request.extra_headers.clone() {
                for (name, value) in headers {
                    if name.eq_ignore_ascii_case("authorization") || name.eq_ignore_ascii_case("content-type") {
                        continue;
                    }
                    retry_builder = retry_builder.header(name, value);
                }
            }
            let retry_response = retry_builder
                .send()
                .await
                .map_err(|error| format!("OpenAI request failed after background fallback: {error}"))?;
            status = retry_response.status();
            body_text = retry_response
                .text()
                .await
                .map_err(|error| format!("Cannot read OpenAI-compatible fallback response body: {error}"))?;
        }
    }
    let mut raw: serde_json::Value = match serde_json::from_str(&body_text) {
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
                    Some(&protocol_mapping),
                )),
                raw: serde_json::json!({
                    "http_status": status.as_u16(),
                    "parse_error": parse_error.to_string(),
                    "body_preview": preview,
                    "visionhub_protocol_mapping": protocol_mapping_raw(&protocol_mapping)
                }),
                created_at: chrono_like_timestamp(),
                generation_mode: Some(generation_mode),
                reference_images: Some(reference_images),
            });
        }
    };
    let mut final_status_code = status.as_u16();
    if protocol == "responses" && status.is_success() {
        match poll_background_response(
            &client,
            &base_url,
            &endpoint_path,
            &api_key,
            request.extra_headers.as_ref(),
            raw.clone(),
        )
        .await
        {
            Ok(polled_raw) => raw = polled_raw,
            Err(error) => {
                let raw = responses_poll_error_raw(raw, &base_url, &endpoint_path, &error);
                let raw = with_protocol_mapping_raw(raw, &protocol_mapping, &request);
                return Ok(ImageGenerationResult {
                    id: format!("openai-{}", chrono_like_timestamp_millis()),
                    provider_id: request.provider_id,
                    model_id: request.model_id,
                    status: "failed".to_string(),
                    prompt: request.prompt,
                    image_urls: Vec::new(),
                    local_image_paths: Vec::new(),
                    cost_hint: Some("已创建后台任务但未取回有效图片；以中转站/供应商账单为准".to_string()),
                    duration_ms: Some(started.elapsed().as_millis()),
                    error: Some(error),
                    raw,
                    created_at: chrono_like_timestamp(),
                    generation_mode: Some(generation_mode),
                    reference_images: Some(reference_images),
                });
            }
        }
        final_status_code = extract_http_status_hint(&raw).unwrap_or(final_status_code);
    }

    let image_urls = extract_image_urls(&raw, None);
    let request_succeeded = (200..300).contains(&final_status_code);
    let local_image_paths = if request_succeeded && !image_urls.is_empty() {
        save_images_to_library(&app, &image_urls, &request)
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let display_image_urls = display_library_image_urls_for_paths(&app, &local_image_paths, &image_urls);

    let error = if request_succeeded && !image_urls.is_empty() {
        None
    } else {
        Some(format_openai_compatible_error(
            final_status_code,
            extract_error_message(&raw).as_deref(),
            None,
            None,
            Some(&protocol_mapping),
        ))
    };
    raw = with_protocol_mapping_raw(raw, &protocol_mapping, &request);

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

async fn generate_minimax_image(
    app: tauri::AppHandle,
    request: OpenAIImageRequest,
) -> Result<ImageGenerationResult, String> {
    let started = std::time::Instant::now();
    let provider_id = request.provider_id.clone();
    let model_id = request.model_id.clone();
    let prompt = request.prompt.clone();
    let api_key = read_provider_secret(request.secret_id.as_deref(), &request.provider_id)
        .map_err(|_| "MiniMax API Key is not configured. Save it in Provider settings first.".to_string())?;
    let generation_mode = request
        .generation_mode
        .clone()
        .unwrap_or_else(|| "text-to-image".to_string());
    let reference_images = request.reference_images.clone().unwrap_or_default();
    let is_image_to_image = generation_mode == "image-to-image" || !reference_images.is_empty();
    if is_image_to_image && reference_images.is_empty() {
        return Ok(ImageGenerationResult {
            id: format!("minimax-{}", chrono_like_timestamp_millis()),
            provider_id: provider_id.clone(),
            model_id: model_id.clone(),
            status: "failed".to_string(),
            prompt: prompt.clone(),
            image_urls: Vec::new(),
            local_image_paths: Vec::new(),
            cost_hint: Some("未提交 MiniMax 请求。".to_string()),
            duration_ms: Some(started.elapsed().as_millis()),
            error: Some("MiniMax 官方图生图需要先添加一张人物主体参考图。".to_string()),
            raw: serde_json::json!({
                "provider": "minimax",
                "blocked_reason": "missing_subject_reference"
            }),
            created_at: chrono_like_timestamp(),
            generation_mode: Some(generation_mode),
            reference_images: Some(reference_images),
        });
    }

    let base_url = normalize_base_url(
        request
            .base_url
            .as_deref()
            .unwrap_or("https://api.minimaxi.com"),
    )?;
    let endpoint_path = normalize_endpoint_path(
        request.endpoint_path.as_deref().or(Some("/v1/image_generation")),
        "custom-images",
    )?;
    let endpoint = format!("{base_url}{endpoint_path}");
    let client = reqwest::Client::new();
    let api_size = normalize_minimax_image_size(&request.size);
    let subject_reference = if is_image_to_image {
        Some(build_minimax_subject_reference(&client, &reference_images).await?)
    } else {
        None
    };
    let mut payload = serde_json::json!({
        "model": model_id,
        "prompt": prompt,
        "aspect_ratio": minimax_aspect_ratio(&api_size),
        "n": request.count.max(1).min(9),
        "prompt_optimizer": false,
        "response_format": "url"
    });
    if let Some(subject_reference) = subject_reference.as_ref() {
        payload["subject_reference"] = serde_json::json!(subject_reference);
    }

    let mut builder = client.post(&endpoint).bearer_auth(&api_key).json(&payload);
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
        .map_err(|error| format!("MiniMax request failed: {error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("Cannot read MiniMax response body: {error}"))?;
    let raw: serde_json::Value = match serde_json::from_str(&body_text) {
        Ok(raw) => raw,
        Err(parse_error) => {
            let preview: String = body_text.chars().take(600).collect();
            return Ok(ImageGenerationResult {
                id: format!("minimax-{}", chrono_like_timestamp_millis()),
                provider_id: provider_id.clone(),
                model_id: model_id.clone(),
                status: "failed".to_string(),
                prompt: prompt.clone(),
                image_urls: Vec::new(),
                local_image_paths: Vec::new(),
                cost_hint: Some("未产生有效图片；以 MiniMax 官方账单为准。".to_string()),
                duration_ms: Some(started.elapsed().as_millis()),
                error: Some(format!("MiniMax 响应不是有效 JSON：{parse_error}")),
                raw: serde_json::json!({
                    "http_status": status.as_u16(),
                    "parse_error": parse_error.to_string(),
                    "body_preview": preview,
                    "visionhub_minimax_request": {
                        "endpoint": endpoint,
                        "model": model_id,
                        "aspect_ratio": minimax_aspect_ratio(&api_size),
                        "size": api_size,
                        "prompt_optimizer": false,
                        "response_format": "url",
                        "subject_reference_count": if is_image_to_image { 1 } else { 0 },
                        "omitted_reference_count": if is_image_to_image { reference_images.len().saturating_sub(1) } else { 0 }
                    },
                    "visionhub_minimax_diagnostic": {
                        "category": "response_parse",
                        "suggestion": "MiniMax 返回内容不是 JSON。请检查 Base URL、接口路径和账号网关返回内容。"
                    }
                }),
                created_at: chrono_like_timestamp(),
                generation_mode: Some(generation_mode),
                reference_images: Some(reference_images),
            });
        }
    };
    let image_urls = extract_image_urls(&raw, request.output_format.as_deref());
    let request_succeeded = status.is_success() && !image_urls.is_empty() && !minimax_raw_has_error(&raw);
    let minimax_diagnostic_category = minimax_error_category(status.as_u16(), &raw);
    let local_image_paths = if request_succeeded {
        save_images_to_library(&app, &image_urls, &request)
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let display_image_urls = display_library_image_urls_for_paths(&app, &local_image_paths, &image_urls);
    let error = if request_succeeded {
        None
    } else {
        Some(format_minimax_error(status.as_u16(), &raw))
    };

    Ok(ImageGenerationResult {
        id: format!("minimax-{}", chrono_like_timestamp_millis()),
        provider_id: provider_id.clone(),
        model_id: model_id.clone(),
        status: if error.is_some() { "failed" } else { "succeeded" }.to_string(),
        prompt: prompt.clone(),
        image_urls: display_image_urls,
        local_image_paths,
        cost_hint: Some("以 MiniMax 官方账单为准。".to_string()),
        duration_ms: Some(started.elapsed().as_millis()),
        error,
        raw: serde_json::json!({
            "provider": "minimax",
            "http_status": status.as_u16(),
            "response": raw,
            "visionhub_minimax_request": {
                "endpoint": endpoint,
                "model": model_id,
                "aspect_ratio": minimax_aspect_ratio(&api_size),
                "size": api_size,
                "count": request.count.max(1).min(9),
                "prompt_optimizer": false,
                "response_format": "url",
                "subject_reference_count": if is_image_to_image { 1 } else { 0 },
                "omitted_reference_count": if is_image_to_image { reference_images.len().saturating_sub(1) } else { 0 }
            },
            "visionhub_minimax_diagnostic": {
                "category": minimax_diagnostic_category,
                "suggestion": minimax_error_suggestion(minimax_diagnostic_category)
            }
        }),
        created_at: chrono_like_timestamp(),
        generation_mode: Some(generation_mode),
        reference_images: Some(reference_images),
    })
}

#[tauri::command]
async fn list_openai_compatible_models(request: ListModelsRequest) -> Result<Vec<ModelInfo>, String> {
    let api_key = read_provider_secret(request.secret_id.as_deref(), &request.provider_id)
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
    let trimmed_body = body_text.trim_start();
    if trimmed_body.starts_with('<') {
        let preview: String = body_text.chars().take(240).collect();
        return Err(format!(
            "Model list endpoint returned HTML instead of JSON. HTTP {status}. This relay may block /v1/models or require browser verification. Body preview: {preview}"
        ));
    }
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
async fn diagnose_comfyui_connection(request: ComfyUIDiagnosisRequest) -> Result<ComfyUIDiagnosisResult, String> {
    let started = std::time::Instant::now();
    let base_url = request.base_url.trim();
    if base_url.is_empty() {
        return Err("请先填写 ComfyUI Base URL。".to_string());
    }
    let resolved_base_url = normalize_base_url(base_url)?;
    let timeout_ms = request.timeout_ms.unwrap_or(8_000).clamp(2_000, 20_000);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|error| format!("Cannot create ComfyUI diagnosis client: {error}"))?;

    let mut endpoints = Vec::new();
    let mut system_stats: Option<Value> = None;
    let mut object_info_node_count: Option<usize> = None;
    let mut queue_running: Option<usize> = None;
    let mut queue_pending: Option<usize> = None;

    let system_stats_result = fetch_comfyui_json(&client, &resolved_base_url, "/system_stats").await;
    match system_stats_result {
        Ok((status, raw)) => {
            system_stats = Some(raw.clone());
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/system_stats".to_string(),
                ok: true,
                status: Some(status.as_u16()),
                detail: summarize_comfyui_system_stats(&raw),
            });
        }
        Err(error) => {
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/system_stats".to_string(),
                ok: false,
                status: error.status,
                detail: error.detail,
            });
        }
    }

    let object_info_result = fetch_comfyui_json(&client, &resolved_base_url, "/object_info").await;
    match object_info_result {
        Ok((status, raw)) => {
            object_info_node_count = raw.as_object().map(|value| value.len());
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/object_info".to_string(),
                ok: true,
                status: Some(status.as_u16()),
                detail: match object_info_node_count {
                    Some(count) => format!("读取到 {count} 个节点定义。"),
                    None => "读取到对象信息，但没有可统计的节点定义。".to_string(),
                },
            });
        }
        Err(error) => {
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/object_info".to_string(),
                ok: false,
                status: error.status,
                detail: error.detail,
            });
        }
    }

    let queue_result = fetch_comfyui_json(&client, &resolved_base_url, "/queue").await;
    match queue_result {
        Ok((status, raw)) => {
            let (running, pending) = extract_comfyui_queue_counts(&raw);
            queue_running = running;
            queue_pending = pending;
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/queue".to_string(),
                ok: true,
                status: Some(status.as_u16()),
                detail: match (running, pending) {
                    (Some(running), Some(pending)) => format!("队列运行 {running} 个，待处理 {pending} 个。"),
                    (Some(running), None) => format!("队列运行 {running} 个。"),
                    (None, Some(pending)) => format!("队列待处理 {pending} 个。"),
                    _ => "读取到队列信息，但未识别运行中或待处理数量。".to_string(),
                },
            });
        }
        Err(error) => {
            endpoints.push(ComfyUIDiagnosisEndpoint {
                path: "/queue".to_string(),
                ok: false,
                status: error.status,
                detail: error.detail,
            });
        }
    }

    let online = endpoints.iter().any(|endpoint| endpoint.ok);
    let success_count = endpoints.iter().filter(|endpoint| endpoint.ok).count();
    let message = if online {
        let mut fragments: Vec<String> = Vec::new();
        if system_stats.is_some() {
            fragments.push("系统信息已读到".to_string());
        }
        if let Some(count) = object_info_node_count {
            fragments.push(format!("节点 {count} 个"));
        }
        if queue_running.is_some() || queue_pending.is_some() {
            fragments.push("队列已探测".to_string());
        }
        format!(
            "ComfyUI 连接正常：{success_count}/3 个基础接口可访问，{}。",
            fragments.join("，")
        )
    } else {
        "ComfyUI 暂时未连通：三个基础接口都没有成功返回。请检查地址、端口和服务是否已启动。".to_string()
    };

    Ok(ComfyUIDiagnosisResult {
        base_url: base_url.to_string(),
        resolved_base_url,
        checked_at: chrono_like_timestamp(),
        latency_ms: started.elapsed().as_millis(),
        online,
        system_stats,
        object_info_node_count,
        queue_running,
        queue_pending,
        endpoints,
        message,
    })
}

#[tauri::command]
async fn generate_comfyui_image(
    app: tauri::AppHandle,
    request: ComfyUIGenerationRequest,
) -> Result<ImageGenerationResult, String> {
    let started = std::time::Instant::now();
    let base_url = request.base_url.trim();
    if base_url.is_empty() {
        return Err("请先填写 ComfyUI Base URL。".to_string());
    }
    if request.prompt.trim().is_empty() {
        return Err("请先输入 Prompt。".to_string());
    }

    let resolved_base_url = normalize_base_url(base_url)?;
    let timeout_ms = request.timeout_ms.unwrap_or(180_000).clamp(10_000, 600_000);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(20_000))
        .build()
        .map_err(|error| format!("Cannot create ComfyUI client: {error}"))?;
    let workflow_name = request
        .workflow_name
        .clone()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "ComfyUI Workflow".to_string());
    let mut workflow = request.workflow.clone();
    let mapping = match apply_comfyui_workflow_inputs(&mut workflow, &request) {
        Ok(mapping) => mapping,
        Err(error) => {
            return Ok(comfyui_failed_result(
                &request,
                &workflow_name,
                started.elapsed().as_millis(),
                error,
                serde_json::json!({
                    "visionhub_comfyui_error": "workflow_mapping_failed",
                    "workflow_name": workflow_name
                }),
            ));
        }
    };

    let prompt_payload = serde_json::json!({
        "prompt": workflow,
        "client_id": format!("visionhub-studio-{}", chrono_like_timestamp_millis())
    });
    let prompt_response = match post_comfyui_prompt(&client, &resolved_base_url, &prompt_payload).await {
        Ok(raw) => raw,
        Err(error) => {
            return Ok(comfyui_failed_result(
                &request,
                &workflow_name,
                started.elapsed().as_millis(),
                error,
                serde_json::json!({
                    "visionhub_comfyui_mapping": mapping,
                    "visionhub_comfyui_error": "prompt_submit_failed"
                }),
            ));
        }
    };
    let Some(prompt_id) = prompt_response
        .get("prompt_id")
        .and_then(Value::as_str)
        .map(str::to_string)
    else {
        return Ok(comfyui_failed_result(
            &request,
            &workflow_name,
            started.elapsed().as_millis(),
            "ComfyUI 已返回响应，但没有 prompt_id，无法继续轮询结果。".to_string(),
            serde_json::json!({
                "prompt_response": prompt_response,
                "visionhub_comfyui_mapping": mapping
            }),
        ));
    };

    let history = match poll_comfyui_history(&client, &resolved_base_url, &prompt_id, timeout_ms).await {
        Ok(history) => history,
        Err(error) => {
            return Ok(comfyui_failed_result(
                &request,
                &workflow_name,
                started.elapsed().as_millis(),
                error,
                serde_json::json!({
                    "prompt_id": prompt_id,
                    "prompt_response": prompt_response,
                    "visionhub_comfyui_mapping": mapping
                }),
            ));
        }
    };
    let image_refs = extract_comfyui_image_refs(&history);
    if image_refs.is_empty() {
        return Ok(comfyui_failed_result(
            &request,
            &workflow_name,
            started.elapsed().as_millis(),
            "ComfyUI 任务完成，但 history 里没有找到输出图片。请确认 workflow 里有 SaveImage 或 PreviewImage 输出节点。".to_string(),
            serde_json::json!({
                "prompt_id": prompt_id,
                "prompt_response": prompt_response,
                "history": history,
                "visionhub_comfyui_mapping": mapping
            }),
        ));
    }

    let local_image_paths = match save_comfyui_images_to_library(&app, &client, &resolved_base_url, &image_refs, &request, &workflow_name).await {
        Ok(paths) => paths,
        Err(error) => {
            return Ok(comfyui_failed_result(
                &request,
                &workflow_name,
                started.elapsed().as_millis(),
                error,
                serde_json::json!({
                    "prompt_id": prompt_id,
                    "prompt_response": prompt_response,
                    "history": history,
                    "images": image_refs.iter().map(comfyui_image_ref_raw).collect::<Vec<Value>>(),
                    "visionhub_comfyui_mapping": mapping
                }),
            ));
        }
    };
    let display_image_urls = display_library_image_urls_for_paths(&app, &local_image_paths, &[]);

    Ok(ImageGenerationResult {
        id: format!("comfyui-{}", chrono_like_timestamp_millis()),
        provider_id: "comfyui-local".to_string(),
        model_id: workflow_name,
        status: "succeeded".to_string(),
        prompt: request.prompt,
        image_urls: display_image_urls,
        local_image_paths,
        cost_hint: Some("本地 ComfyUI 生成，不消耗在线 API 额度。".to_string()),
        duration_ms: Some(started.elapsed().as_millis()),
        error: None,
        raw: serde_json::json!({
            "prompt_id": prompt_id,
            "prompt_response": prompt_response,
            "history": history,
            "images": image_refs.iter().map(comfyui_image_ref_raw).collect::<Vec<Value>>(),
            "visionhub_comfyui_mapping": mapping
        }),
        created_at: chrono_like_timestamp(),
        generation_mode: Some("text-to-image".to_string()),
        reference_images: Some(Vec::new()),
    })
}

struct ComfyUIDiagnosisError {
    status: Option<u16>,
    detail: String,
}

async fn fetch_comfyui_json(
    client: &reqwest::Client,
    base_url: &str,
    path: &str,
) -> Result<(reqwest::StatusCode, Value), ComfyUIDiagnosisError> {
    let endpoint = format!("{base_url}{path}");
    let response = client
        .get(endpoint)
        .send()
        .await
        .map_err(|error| ComfyUIDiagnosisError {
            status: None,
            detail: format!("请求失败：{error}"),
        })?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| ComfyUIDiagnosisError {
            status: Some(status.as_u16()),
            detail: format!("响应读取失败：{error}"),
        })?;
    let trimmed_body = body_text.trim_start();
    if trimmed_body.starts_with('<') {
        let preview: String = body_text.chars().take(180).collect();
        return Err(ComfyUIDiagnosisError {
            status: Some(status.as_u16()),
            detail: format!("返回了网页而不是 JSON，可能不是 ComfyUI 服务。预览：{preview}"),
        });
    }
    let raw: Value = serde_json::from_str(&body_text).map_err(|error| ComfyUIDiagnosisError {
        status: Some(status.as_u16()),
        detail: format!("JSON 解析失败：{error}"),
    })?;
    if !status.is_success() {
        return Err(ComfyUIDiagnosisError {
            status: Some(status.as_u16()),
            detail: extract_error_message(&raw)
                .unwrap_or_else(|| format!("HTTP {status}")),
        });
    }
    Ok((status, raw))
}

fn summarize_comfyui_system_stats(raw: &Value) -> String {
    let system = raw.get("system").and_then(|value| value.as_object());
    let os = system
        .and_then(|value| value.get("os"))
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let python_version = system
        .and_then(|value| value.get("python_version"))
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let devices = raw
        .get("devices")
        .and_then(|value| value.as_array())
        .map(|value| value.len());
    let device_names = raw
        .get("devices")
        .and_then(|value| value.as_array())
        .map(|devices| {
            devices
                .iter()
                .filter_map(|device| {
                    device
                        .get("name")
                        .or_else(|| device.get("type"))
                        .and_then(|value| value.as_str())
                })
                .take(2)
                .collect::<Vec<_>>()
                .join(" / ")
        })
        .unwrap_or_default();
    let mut parts = Vec::new();
    if !os.is_empty() {
        parts.push(format!("系统 {os}"));
    }
    if !python_version.is_empty() {
        parts.push(format!("Python {python_version}"));
    }
    if let Some(count) = devices {
        let device_detail = if device_names.is_empty() {
            format!("设备 {count} 个")
        } else {
            format!("设备 {count} 个：{device_names}")
        };
        parts.push(device_detail);
    }
    if parts.is_empty() {
        "系统信息接口已返回。".to_string()
    } else {
        parts.join("，")
    }
}

fn extract_comfyui_queue_counts(raw: &Value) -> (Option<usize>, Option<usize>) {
    let running = raw
        .get("queue_running")
        .and_then(|value| value.as_array())
        .map(|value| value.len());
    let pending = raw
        .get("queue_pending")
        .and_then(|value| value.as_array())
        .map(|value| value.len());
    (running, pending)
}

fn comfyui_failed_result(
    request: &ComfyUIGenerationRequest,
    workflow_name: &str,
    duration_ms: u128,
    error: String,
    raw: Value,
) -> ImageGenerationResult {
    ImageGenerationResult {
        id: format!("comfyui-{}", chrono_like_timestamp_millis()),
        provider_id: "comfyui-local".to_string(),
        model_id: workflow_name.to_string(),
        status: "failed".to_string(),
        prompt: request.prompt.clone(),
        image_urls: Vec::new(),
        local_image_paths: Vec::new(),
        cost_hint: Some("本地 ComfyUI 生成，不消耗在线 API 额度。".to_string()),
        duration_ms: Some(duration_ms),
        error: Some(error),
        raw,
        created_at: chrono_like_timestamp(),
        generation_mode: Some("text-to-image".to_string()),
        reference_images: Some(Vec::new()),
    }
}

async fn post_comfyui_prompt(
    client: &reqwest::Client,
    base_url: &str,
    payload: &Value,
) -> Result<Value, String> {
    let endpoint = format!("{base_url}/prompt");
    let response = client
        .post(endpoint)
        .json(payload)
        .send()
        .await
        .map_err(|error| format!("ComfyUI /prompt 提交失败：{error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("ComfyUI /prompt 响应读取失败：{error}"))?;
    let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
        let preview: String = body_text.chars().take(500).collect();
        format!("ComfyUI /prompt 返回不是 JSON：{error}。预览：{preview}")
    })?;
    if !status.is_success() {
        return Err(extract_error_message(&raw).unwrap_or_else(|| format!("ComfyUI /prompt HTTP {status}")));
    }
    Ok(raw)
}

async fn poll_comfyui_history(
    client: &reqwest::Client,
    base_url: &str,
    prompt_id: &str,
    timeout_ms: u64,
) -> Result<Value, String> {
    let started = std::time::Instant::now();
    let endpoint = format!("{base_url}/history/{prompt_id}");
    loop {
        let response = client
            .get(&endpoint)
            .send()
            .await
            .map_err(|error| format!("ComfyUI history 轮询失败：{error}"))?;
        let status = response.status();
        let body_text = response
            .text()
            .await
            .map_err(|error| format!("ComfyUI history 响应读取失败：{error}"))?;
        let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
            let preview: String = body_text.chars().take(500).collect();
            format!("ComfyUI history 返回不是 JSON：{error}。预览：{preview}")
        })?;
        if !status.is_success() {
            return Err(extract_error_message(&raw).unwrap_or_else(|| format!("ComfyUI history HTTP {status}")));
        }
        if let Some(entry) = raw.get(prompt_id) {
            return Ok(entry.clone());
        }
        if started.elapsed() >= Duration::from_millis(timeout_ms) {
            return Err(format!("ComfyUI 任务已提交，但 {timeout_ms}ms 内没有从 history 取回结果。可稍后到 ComfyUI 界面或作品目录确认。"));
        }
        tokio::time::sleep(Duration::from_millis(1_500)).await;
    }
}

fn apply_comfyui_workflow_inputs(
    workflow: &mut Value,
    request: &ComfyUIGenerationRequest,
) -> Result<Value, String> {
    let Some(nodes) = workflow.as_object_mut() else {
        return Err("当前导入的 workflow 不是 ComfyUI API workflow。请在 ComfyUI 里启用 Dev mode 后导出 API 格式 workflow。".to_string());
    };
    let has_api_nodes = nodes.values().any(|node| {
        node.get("class_type").and_then(Value::as_str).is_some()
            && node.get("inputs").and_then(Value::as_object).is_some()
    });
    if !has_api_nodes {
        return Err("当前 workflow 看起来是 UI workflow，不是可直接提交的 API workflow。请从 ComfyUI 导出 API workflow 后再测试。".to_string());
    }

    let (width, height) = parse_image_size(&request.size).unwrap_or((1024, 1024));
    let batch_size = request.count.unwrap_or(1).max(1).min(4);
    let seed = request.seed.unwrap_or_else(|| (chrono_like_timestamp_millis() % (u64::MAX as u128)) as u64);
    let mut positive_node_ids: Vec<String> = Vec::new();
    let mut negative_node_ids: Vec<String> = Vec::new();
    let mut sampler_node_ids: Vec<String> = Vec::new();
    let mut size_node_ids: Vec<String> = Vec::new();

    for (node_id, node) in nodes.iter() {
        let class_type = node.get("class_type").and_then(Value::as_str).unwrap_or("");
        let lower = class_type.to_ascii_lowercase();
        let inputs = node.get("inputs").and_then(Value::as_object);
        if lower.contains("ksampler") || lower.contains("sampler") {
            sampler_node_ids.push(node_id.clone());
            if let Some(id) = inputs.and_then(|inputs| connected_comfyui_node_id(inputs.get("positive"))) {
                positive_node_ids.push(id);
            }
            if let Some(id) = inputs.and_then(|inputs| connected_comfyui_node_id(inputs.get("negative"))) {
                negative_node_ids.push(id);
            }
        }
        if lower.contains("emptylatent") || lower.contains("latentsize") {
            size_node_ids.push(node_id.clone());
        }
    }

    if positive_node_ids.is_empty() {
        positive_node_ids = nodes
            .iter()
            .filter_map(|(node_id, node)| {
                let class_type = node.get("class_type").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase();
                let has_text = node
                    .get("inputs")
                    .and_then(Value::as_object)
                    .and_then(|inputs| inputs.get("text"))
                    .is_some();
                if class_type.contains("cliptextencode") && has_text {
                    Some(node_id.clone())
                } else {
                    None
                }
            })
            .take(1)
            .collect();
    }
    if negative_node_ids.is_empty() {
        negative_node_ids = nodes
            .iter()
            .filter_map(|(node_id, node)| {
                let class_type = node.get("class_type").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase();
                let has_text = node
                    .get("inputs")
                    .and_then(Value::as_object)
                    .and_then(|inputs| inputs.get("text"))
                    .is_some();
                if class_type.contains("cliptextencode") && has_text && !positive_node_ids.contains(node_id) {
                    Some(node_id.clone())
                } else {
                    None
                }
            })
            .take(1)
            .collect();
    }

    for node_id in &positive_node_ids {
        if let Some(inputs) = nodes
            .get_mut(node_id)
            .and_then(|node| node.get_mut("inputs"))
            .and_then(Value::as_object_mut)
        {
            inputs.insert("text".to_string(), Value::String(request.prompt.clone()));
        }
    }
    for node_id in &negative_node_ids {
        if let Some(inputs) = nodes
            .get_mut(node_id)
            .and_then(|node| node.get_mut("inputs"))
            .and_then(Value::as_object_mut)
        {
            inputs.insert(
                "text".to_string(),
                Value::String(request.negative_prompt.clone().unwrap_or_default()),
            );
        }
    }
    for node_id in &sampler_node_ids {
        if let Some(inputs) = nodes
            .get_mut(node_id)
            .and_then(|node| node.get_mut("inputs"))
            .and_then(Value::as_object_mut)
        {
            if inputs.contains_key("seed") {
                inputs.insert("seed".to_string(), serde_json::json!(seed));
            }
            if inputs.contains_key("noise_seed") {
                inputs.insert("noise_seed".to_string(), serde_json::json!(seed));
            }
        }
    }
    for node_id in &size_node_ids {
        if let Some(inputs) = nodes
            .get_mut(node_id)
            .and_then(|node| node.get_mut("inputs"))
            .and_then(Value::as_object_mut)
        {
            if inputs.contains_key("width") {
                inputs.insert("width".to_string(), serde_json::json!(width));
            }
            if inputs.contains_key("height") {
                inputs.insert("height".to_string(), serde_json::json!(height));
            }
            if inputs.contains_key("batch_size") {
                inputs.insert("batch_size".to_string(), serde_json::json!(batch_size));
            }
        }
    }

    Ok(serde_json::json!({
        "format": "comfyui-api-workflow",
        "positive_nodes": positive_node_ids,
        "negative_nodes": negative_node_ids,
        "sampler_nodes": sampler_node_ids,
        "size_nodes": size_node_ids,
        "width": width,
        "height": height,
        "seed": seed,
        "batch_size": batch_size
    }))
}

fn connected_comfyui_node_id(value: Option<&Value>) -> Option<String> {
    let value = value?;
    if let Some(items) = value.as_array() {
        return items.first().and_then(|item| {
            if let Some(text) = item.as_str() {
                Some(text.to_string())
            } else {
                item.as_i64().map(|number| number.to_string())
            }
        });
    }
    value.as_str().map(str::to_string)
}

fn extract_comfyui_image_refs(history: &Value) -> Vec<ComfyUIImageRef> {
    let mut refs = Vec::new();
    collect_comfyui_image_refs(history, &mut refs);
    let mut unique: Vec<ComfyUIImageRef> = Vec::new();
    for image_ref in refs {
        if !unique.contains(&image_ref) {
            unique.push(image_ref);
        }
    }
    unique
}

fn collect_comfyui_image_refs(value: &Value, refs: &mut Vec<ComfyUIImageRef>) {
    match value {
        Value::Object(map) => {
            if let Some(filename) = map.get("filename").and_then(Value::as_str) {
                refs.push(ComfyUIImageRef {
                    filename: filename.to_string(),
                    subfolder: map
                        .get("subfolder")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    image_type: map
                        .get("type")
                        .and_then(Value::as_str)
                        .unwrap_or("output")
                        .to_string(),
                });
            }
            for child in map.values() {
                collect_comfyui_image_refs(child, refs);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_comfyui_image_refs(item, refs);
            }
        }
        _ => {}
    }
}

fn comfyui_image_ref_raw(image_ref: &ComfyUIImageRef) -> Value {
    serde_json::json!({
        "filename": image_ref.filename,
        "subfolder": image_ref.subfolder,
        "type": image_ref.image_type
    })
}

async fn save_comfyui_images_to_library(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    base_url: &str,
    images: &[ComfyUIImageRef],
    request: &ComfyUIGenerationRequest,
    workflow_name: &str,
) -> Result<Vec<String>, String> {
    let dir = library_dir(app)?;
    let mut saved_paths = Vec::new();
    for (index, image_ref) in images.iter().enumerate() {
        let endpoint = format!("{base_url}/view");
        let response = client
            .get(endpoint)
            .query(&[
                ("filename", image_ref.filename.as_str()),
                ("subfolder", image_ref.subfolder.as_str()),
                ("type", image_ref.image_type.as_str()),
            ])
            .send()
            .await
            .map_err(|error| format!("ComfyUI 图片下载失败：{error}"))?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("ComfyUI 图片下载失败：HTTP {status}"));
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let source_extension = extension_from_content_type(&content_type);
        let bytes = response
            .bytes()
            .await
            .map_err(|error| format!("ComfyUI 图片内容读取失败：{error}"))?
            .to_vec();
        let (bytes, extension) = convert_generated_image_bytes(
            bytes,
            &source_extension,
            request.output_format.as_deref(),
            request.output_compression,
        )?;
        let filename = format!(
            "{}-comfyui-{}-{}.{}",
            chrono_like_timestamp_millis(),
            sanitize_filename(workflow_name),
            index + 1,
            extension
        );
        let path = dir.join(filename);
        std::fs::write(&path, bytes)
            .map_err(|error| format!("Cannot save ComfyUI generated image: {error}"))?;
        saved_paths.push(path_to_user_string(&path));
    }
    Ok(saved_paths)
}

#[tauri::command]
async fn polish_prompt_with_provider(request: PromptPolishRequest) -> Result<PromptPolishResult, String> {
    if request.prompt.trim().is_empty() {
        return Err("请先输入要润色的提示词。".to_string());
    }
    if request.model_id.trim().is_empty() {
        return Err("请先在偏好设置里选择提示词润色模型。".to_string());
    }

    let api_key = read_provider_secret(request.secret_id.as_deref(), &request.provider_id)
        .map_err(|_| "润色专用 API Key 未配置：请先到「偏好设置」保存提示词润色专用 Key。".to_string())?;
    let base_url_text = request
        .base_url
        .as_deref()
        .unwrap_or("")
        .trim();
    if base_url_text.is_empty() {
        return Err("请先到「偏好设置」填写提示词润色专用 Base URL。".to_string());
    }
    let base_url = normalize_base_url(base_url_text)?;
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
    let polished_prompt = ensure_prompt_polish_changed(&request.prompt, &polished_prompt, &request.mode_id);

    Ok(PromptPolishResult {
        provider_id: request.provider_id,
        model_id: request.model_id,
        prompt: request.prompt,
        polished_prompt,
        raw,
        created_at: chrono_like_timestamp(),
    })
}

#[tauri::command]
fn load_generation_history(app: tauri::AppHandle) -> Result<Vec<GenerationRecord>, String> {
    let mut records = read_generation_history_records(&app)?;
    let mut changed = false;
    for record in &mut records {
        changed |= hydrate_record_image_urls(&app, record);
    }
    if changed {
        write_generation_history(&app, &records)?;
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
fn load_library_data(app: tauri::AppHandle) -> Result<LibraryData, String> {
    read_library_data(&app)
}

#[tauri::command]
fn save_library_data(
    app: tauri::AppHandle,
    mut data: LibraryData,
) -> Result<LibraryData, String> {
    data.version = library_data_version();
    data.exists = true;
    data.updated_at = Some(chrono_like_timestamp());
    write_library_data(&app, &data)?;
    Ok(data)
}

fn read_library_data(app: &tauri::AppHandle) -> Result<LibraryData, String> {
    let path = library_meta_file_path(app)?;
    if !path.exists() {
        return Ok(default_library_data(false));
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read library metadata: {error}"))?;
    if text.trim().is_empty() {
        return Ok(default_library_data(true));
    }

    let mut data: LibraryData = serde_json::from_str(&text)
        .map_err(|error| format!("Cannot parse library metadata: {error}"))?;
    data.exists = true;
    Ok(data)
}

fn write_library_data(app: &tauri::AppHandle, data: &LibraryData) -> Result<(), String> {
    let path = library_meta_file_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Cannot resolve library metadata directory.".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("Cannot create library metadata directory: {error}"))?;
    let tmp_path = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(data)
        .map_err(|error| format!("Cannot serialize library metadata: {error}"))?;
    std::fs::write(&tmp_path, text)
        .map_err(|error| format!("Cannot write temporary library metadata: {error}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Cannot replace library metadata: {error}"))
}

fn default_library_data(exists: bool) -> LibraryData {
    LibraryData {
        version: library_data_version(),
        exists,
        meta: empty_json_object(),
        organization: empty_library_organization(),
        display_settings: empty_json_object(),
        custom_quick_filters: empty_json_array(),
        updated_at: None,
    }
}

fn library_data_version() -> u32 {
    1
}

fn empty_json_object() -> Value {
    serde_json::json!({})
}

fn empty_json_array() -> Value {
    serde_json::json!([])
}

fn empty_library_organization() -> Value {
    serde_json::json!({
        "folders": [],
        "collections": []
    })
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
async fn recheck_background_generation(
    app: tauri::AppHandle,
    request: RecheckBackgroundGenerationRequest,
) -> Result<GenerationRecord, String> {
    let record_id = request.record_id.trim().to_string();
    if record_id.is_empty() {
        return Err("Generation record id cannot be empty.".to_string());
    }

    let mut records = read_generation_history_records(&app)?;
    let Some(index) = records.iter().position(|item| item.id == record_id) else {
        return Err("没有找到这条生成记录，无法重查后台任务。".to_string());
    };
    let previous_record = records[index].clone();
    let poll_url = extract_background_poll_url(&previous_record.raw)
        .ok_or_else(|| "这条记录没有保存可重查的 poll_url，无法自动重查后台任务。".to_string())?;
    if !(poll_url.starts_with("https://") || poll_url.starts_with("http://")) {
        return Err("后台重查地址不是有效 HTTP URL，已停止请求。".to_string());
    }

    let api_key = read_provider_secret(request.secret_id.as_deref(), &previous_record.provider_id)
        .map_err(|error| format!("无法读取用于重查的 API Key：{error}"))?;
    let client = reqwest::Client::new();
    let mut builder = client.get(&poll_url).bearer_auth(api_key);
    if let Some(headers) = request.extra_headers.as_ref() {
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
        .map_err(|error| format!("后台任务重查请求失败：{error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("无法读取后台任务重查响应：{error}"))?;
    let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
        let preview: String = body_text.chars().take(600).collect();
        format!("后台任务重查响应不是 JSON：{error}. HTTP {status}. 响应预览：{preview}")
    })?;

    if !status.is_success() {
        return Err(format_openai_compatible_error(
            status.as_u16(),
            extract_error_message(&raw).as_deref(),
            None,
            None,
            None,
        ));
    }

    let image_urls = extract_image_urls(&raw, None);
    if image_urls.is_empty() {
        let response_status = extract_response_status(&raw)
            .unwrap_or_else(|| "未知".to_string());
        return Err(format!(
            "后台任务已重查，但暂未返回可恢复图片。当前任务状态：{response_status}。"
        ));
    }

    let recovery_request = OpenAIImageRequest {
        provider_id: previous_record.provider_id.clone(),
        model_id: previous_record.model_id.clone(),
        prompt: previous_record.prompt.clone(),
        negative_prompt: None,
        size: "1024x1024".to_string(),
        quality: None,
        seed: None,
        output_format: None,
        output_compression: None,
        count: image_urls.len().clamp(1, 4) as u8,
        generation_mode: previous_record.generation_mode.clone(),
        reference_images: previous_record.reference_images.clone(),
        base_url: None,
        protocol: Some("responses".to_string()),
        image_to_image_adapter: None,
        endpoint_path: None,
        extra_headers: None,
        secret_id: request.secret_id.clone(),
    };
    let local_image_paths = save_images_to_library(&app, &image_urls, &recovery_request)
        .await
        .unwrap_or_default();
    let display_image_urls = display_library_image_urls_for_paths(&app, &local_image_paths, &image_urls);
    let recovered_at = chrono_like_timestamp();

    let mut record = previous_record.clone();
    record.status = "succeeded".to_string();
    record.error = None;
    record.image_urls = display_image_urls;
    record.local_image_paths = local_image_paths;
    record.cost_hint = Some("后台任务重查已恢复；实际计费以中转站/供应商账单为准".to_string());
    record.raw = serde_json::json!({
        "visionhub_recovery": {
            "recovered_at": recovered_at,
            "poll_url": poll_url,
            "http_status": status.as_u16(),
            "previous_status": previous_record.status
        },
        "recovered_response": raw,
        "previous_failure": previous_record.raw
    });
    record.saved_at = Some(chrono_like_timestamp());

    records[index] = record.clone();
    write_generation_history(&app, &records)?;

    let mut returned = record;
    hydrate_record_image_urls(&app, &mut returned);
    Ok(returned)
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
fn import_library_images_from_files(app: tauri::AppHandle) -> Result<ImportLibraryImagesResult, String> {
    let paths = pick_image_files_with_system_dialog()?;
    import_library_image_paths(app, paths)
}

#[tauri::command]
fn import_library_images_from_folder(app: tauri::AppHandle) -> Result<ImportLibraryImagesResult, String> {
    let current_dir = library_dir(&app)?;
    let Some(folder) = pick_folder_with_system_dialog(&current_dir)? else {
        return Ok(ImportLibraryImagesResult { records: Vec::new(), skipped_duplicates: 0, skipped_unsupported: 0 });
    };
    let paths = scan_image_files_in_folder(&folder)?;
    import_library_image_paths(app, paths)
}

#[tauri::command]
fn reference_images_from_paths(request: ReferenceImagesFromPathsRequest) -> Result<Vec<ReferenceImage>, String> {
    let limit = request.limit.unwrap_or(4).clamp(1, 4);
    let mut references = Vec::new();
    for path in request.paths.iter() {
        if references.len() >= limit {
            break;
        }
        let file_path = PathBuf::from(path);
        if !file_path.is_file() || !is_supported_reference_image_path(&file_path) {
            continue;
        }
        let canonical = file_path
            .canonicalize()
            .map_err(|error| format!("Cannot resolve dropped image path: {error}"))?;
        let data_url = image_path_to_data_url(&canonical, "dropped reference")?;
        let file_name = canonical
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("拖拽参考图")
            .to_string();
        references.push(ReferenceImage {
            id: format!("drag-drop-{}-{}", chrono_like_timestamp_millis(), references.len()),
            name: Some(file_name),
            mime_type: Some(image_mime_from_path(&canonical).to_string()),
            data_url: Some(data_url.clone()),
            local_path: Some(path_to_user_string(&canonical)),
            preview_url: Some(data_url),
            source: "drag-drop".to_string(),
            source_generation_id: None,
            role: Some("auto".to_string()),
            added_at: Some(chrono_like_timestamp()),
        });
    }
    Ok(references)
}

fn import_library_image_paths(
    app: tauri::AppHandle,
    paths: Vec<PathBuf>,
) -> Result<ImportLibraryImagesResult, String> {
    if paths.is_empty() {
        return Ok(ImportLibraryImagesResult { records: Vec::new(), skipped_duplicates: 0, skipped_unsupported: 0 });
    }

    let mut records = read_generation_history_records(&app)?;
    let now = chrono_like_timestamp();
    let mut imported = Vec::new();
    let mut skipped_duplicates = 0usize;
    let mut skipped_unsupported = 0usize;
    for path in paths {
        if !path.is_file() || !is_supported_image_path(&path) {
            skipped_unsupported += 1;
            continue;
        }
        let canonical = path
            .canonicalize()
            .map_err(|error| format!("Cannot resolve imported image path: {error}"))?;
        let path_text = path_to_user_string(&canonical);
        if records.iter().any(|record| record.local_image_paths.iter().any(|item| item == &path_text)) {
            skipped_duplicates += 1;
            continue;
        }
        let file_name = canonical
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("本地图片")
            .to_string();
        let mut record = GenerationRecord {
            id: format!("local-import-{}-{}", chrono_like_timestamp_millis(), imported.len()),
            provider_id: "local-import".to_string(),
            provider_name: Some("本地导入".to_string()),
            model_id: "local-file".to_string(),
            status: "succeeded".to_string(),
            prompt: format!("本地导入：{file_name}"),
            image_urls: Vec::new(),
            local_image_paths: vec![path_text],
            cost_hint: None,
            duration_ms: None,
            error: None,
            raw: serde_json::json!({
                "visionhubSource": "local-import",
                "fileName": file_name
            }),
            created_at: now.clone(),
            saved_at: Some(now.clone()),
            generation_mode: Some("imported".to_string()),
            reference_images: Some(Vec::new()),
        };
        hydrate_record_image_urls(&app, &mut record);
        records.insert(0, record.clone());
        imported.push(record);
    }

    if !imported.is_empty() {
        records.truncate(500);
        write_generation_history(&app, &records)?;
    }

    Ok(ImportLibraryImagesResult { records: imported, skipped_duplicates, skipped_unsupported })
}

#[tauri::command]
fn load_inspirations(app: tauri::AppHandle) -> Result<InspirationLibrary, String> {
    let sources = read_inspiration_sources(&app)?;
    let mut assets = read_inspiration_assets(&app)?;
    for asset in &mut assets {
        hydrate_inspiration_asset_image_url(&app, asset);
    }
    Ok(InspirationLibrary { sources, assets })
}

#[tauri::command]
fn load_inspiration_sources(app: tauri::AppHandle) -> Result<Vec<InspirationSource>, String> {
    read_inspiration_sources(&app)
}

#[tauri::command]
fn load_inspiration_assets(app: tauri::AppHandle) -> Result<Vec<InspirationAsset>, String> {
    let mut assets = read_inspiration_assets(&app)?;
    for asset in &mut assets {
        hydrate_inspiration_asset_image_url(&app, asset);
    }
    Ok(assets)
}

#[tauri::command]
fn save_inspiration_source(
    app: tauri::AppHandle,
    mut source: InspirationSource,
) -> Result<InspirationSource, String> {
    let now = chrono_like_timestamp();
    if source.id.trim().is_empty() {
        source.id = format!("source-{now}");
    }
    if source.created_at.trim().is_empty() {
        source.created_at = now.clone();
    }
    source.updated_at = now;
    source.tags = clean_string_list(source.tags);
    source.keywords = clean_string_list(source.keywords);

    let mut sources = read_inspiration_sources(&app)?;
    sources.retain(|item| item.id != source.id);
    sources.insert(0, source.clone());
    write_inspiration_sources(&app, &sources)?;
    Ok(source)
}

#[tauri::command]
fn delete_inspiration_source(
    app: tauri::AppHandle,
    source_id: String,
) -> Result<DeleteInspirationResult, String> {
    let source_id = source_id.trim().to_string();
    if source_id.is_empty() {
        return Err("Inspiration source id cannot be empty.".to_string());
    }

    let mut sources = read_inspiration_sources(&app)?;
    let before_len = sources.len();
    sources.retain(|item| item.id != source_id);
    let deleted = sources.len() != before_len;
    if deleted {
        write_inspiration_sources(&app, &sources)?;
    }
    Ok(DeleteInspirationResult { id: source_id, deleted })
}

#[tauri::command]
fn import_inspiration_asset(
    app: tauri::AppHandle,
    request: InspirationAssetImportRequest,
) -> Result<InspirationAsset, String> {
    let title = request.title.trim();
    if title.is_empty() {
        return Err("灵感图片标题不能为空。".to_string());
    }
    if !request.data_url.starts_with("data:image/") {
        return Err("Only data URL images can be imported as inspiration assets.".to_string());
    }

    let (bytes, extension) = decode_data_url_image(&request.data_url)?;
    let dir = inspiration_images_dir(&app)?;
    let now = chrono_like_timestamp();
    let file_stem = request
        .file_name
        .as_deref()
        .map(sanitize_filename)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let sanitized = sanitize_filename(title);
            if sanitized.is_empty() { None } else { Some(sanitized) }
        })
        .unwrap_or_else(|| "inspiration".to_string());
    let filename = format!("{now}-{file_stem}.{extension}");
    let path = dir.join(filename);
    std::fs::write(&path, bytes)
        .map_err(|error| format!("Cannot save inspiration image: {error}"))?;

    let asset = InspirationAsset {
        id: format!("asset-{now}"),
        title: title.to_string(),
        image_path: Some(path_to_user_string(&path)),
        image_url: None,
        thumbnail_path: None,
        source_url: optional_trimmed_string(request.source_url),
        source_platform: optional_trimmed_string(request.source_platform),
        author: optional_trimmed_string(request.author),
        original_prompt: optional_trimmed_string(request.original_prompt),
        inferred_prompt: None,
        tags: clean_string_list(request.tags),
        note: optional_trimmed_string(request.note),
        license_status: request
            .license_status
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "reference-only".to_string()),
        rating: request.rating.filter(|value| (1..=5).contains(value)),
        created_at: now.clone(),
        updated_at: now,
    };

    let mut assets = read_inspiration_assets(&app)?;
    assets.insert(0, asset.clone());
    assets.truncate(1000);
    write_inspiration_assets(&app, &assets)?;

    let mut display_asset = asset;
    hydrate_inspiration_asset_image_url(&app, &mut display_asset);
    Ok(display_asset)
}

#[tauri::command]
fn save_inspiration_asset(
    app: tauri::AppHandle,
    mut asset: InspirationAsset,
) -> Result<InspirationAsset, String> {
    let now = chrono_like_timestamp();
    if asset.id.trim().is_empty() {
        asset.id = format!("asset-{now}");
    }
    if asset.created_at.trim().is_empty() {
        asset.created_at = now.clone();
    }
    asset.updated_at = now;
    asset.tags = clean_string_list(asset.tags);
    asset.source_url = optional_trimmed_string(asset.source_url);
    asset.source_platform = optional_trimmed_string(asset.source_platform);
    asset.author = optional_trimmed_string(asset.author);
    asset.original_prompt = optional_trimmed_string(asset.original_prompt);
    asset.inferred_prompt = optional_trimmed_string(asset.inferred_prompt);
    asset.note = optional_trimmed_string(asset.note);
    asset.rating = asset.rating.filter(|value| (1..=5).contains(value));
    if asset.image_path.is_some() || asset.image_url.as_deref().is_some_and(|url| url.starts_with("data:image/")) {
        asset.image_url = None;
    }

    let mut assets = read_inspiration_assets(&app)?;
    assets.retain(|item| item.id != asset.id);
    assets.insert(0, asset.clone());
    write_inspiration_assets(&app, &assets)?;

    hydrate_inspiration_asset_image_url(&app, &mut asset);
    Ok(asset)
}

#[tauri::command]
fn delete_inspiration_asset(
    app: tauri::AppHandle,
    asset_id: String,
) -> Result<DeleteInspirationResult, String> {
    let asset_id = asset_id.trim().to_string();
    if asset_id.is_empty() {
        return Err("Inspiration asset id cannot be empty.".to_string());
    }

    let mut assets = read_inspiration_assets(&app)?;
    let before_len = assets.len();
    assets.retain(|item| item.id != asset_id);
    let deleted = assets.len() != before_len;
    if deleted {
        write_inspiration_assets(&app, &assets)?;
    }
    Ok(DeleteInspirationResult { id: asset_id, deleted })
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
        library_meta_file: path_to_user_string(&library_meta_file_path(&app)?),
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
fn reveal_inspiration_dir(app: tauri::AppHandle) -> Result<(), String> {
    open_path_in_file_manager(inspiration_images_dir(&app)?)
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
    save_storage_dir_overrides(
        &app,
        request.library_dir_override.as_deref(),
        request.inspiration_dir_override.as_deref(),
    )
}

#[tauri::command]
fn choose_library_dir(app: tauri::AppHandle) -> Result<Option<StorageSettings>, String> {
    let current_dir = library_dir(&app)?;
    let selected_dir = pick_folder_with_system_dialog(&current_dir)?;
    match selected_dir {
        Some(path) => {
            let current_settings = read_storage_settings(&app)?;
            save_storage_dir_overrides(
                &app,
                Some(path.to_string_lossy().as_ref()),
                current_settings.inspiration_dir_override.as_deref(),
            )
            .map(Some)
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn choose_inspiration_dir(app: tauri::AppHandle) -> Result<Option<StorageSettings>, String> {
    let current_dir = inspiration_images_dir(&app)?;
    let selected_dir = pick_folder_with_system_dialog(&current_dir)?;
    match selected_dir {
        Some(path) => {
            let current_settings = read_storage_settings(&app)?;
            save_storage_dir_overrides(
                &app,
                current_settings.library_dir_override.as_deref(),
                Some(path.to_string_lossy().as_ref()),
            )
            .map(Some)
        }
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
        "version": "0.2.3",
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

#[tauri::command]
fn save_text_file_with_dialog(request: SaveTextFileRequest) -> Result<SaveTextFileResult, String> {
    let suggested_file_name = sanitize_save_file_name(&request.suggested_file_name, "visionhub-export.md");
    let Some(path) = pick_save_markdown_file_with_system_dialog(&suggested_file_name)? else {
        return Ok(SaveTextFileResult {
            path: None,
            saved: false,
        });
    };

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Cannot create export folder: {error}"))?;
        }
    }

    std::fs::write(&path, request.content)
        .map_err(|error| format!("Cannot write export file: {error}"))?;

    Ok(SaveTextFileResult {
        path: Some(path_to_user_string(&path)),
        saved: true,
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

fn resolve_image_to_image_protocol_mapping(
    request: &OpenAIImageRequest,
    protocol: &str,
    endpoint_path: &str,
    generation_mode: &str,
    references: &[ReferenceImage],
) -> ImageToImageProtocolMapping {
    let is_image_to_image = generation_mode == "image-to-image" && !references.is_empty();
    let requested_adapter = request
        .image_to_image_adapter
        .as_deref()
        .unwrap_or("auto")
        .trim();
    let adapter = if !is_image_to_image {
        "text-to-image".to_string()
    } else if requested_adapter != "auto" && is_supported_image_to_image_adapter(requested_adapter) {
        requested_adapter.to_string()
    } else if request.provider_id == "openai-gpt-image" && protocol == "images" {
        "openai-images-edit".to_string()
    } else {
        match protocol {
            "responses" => "responses-input-image".to_string(),
            "chat-completions" => "chat-image-url".to_string(),
            _ => "json-image-array".to_string(),
        }
    };
    let reference_fields = match adapter.as_str() {
        "openai-images-edit" => {
            if references.len() > 1 {
                vec!["image".to_string(), "image[]".to_string()]
            } else {
                vec!["image".to_string()]
            }
        }
        "responses-input-image" => vec!["input_text".to_string(), "input_image".to_string()],
        "chat-image-url" => vec!["text".to_string(), "image_url".to_string()],
        "json-image-array" => vec!["image".to_string(), "images".to_string()],
        _ => Vec::new(),
    };
    let request_shape = if adapter == "openai-images-edit" {
        "multipart"
    } else {
        "json"
    };

    ImageToImageProtocolMapping {
        generation_mode: generation_mode.to_string(),
        image_to_image_adapter: adapter,
        protocol: protocol.to_string(),
        endpoint_path: endpoint_path.to_string(),
        request_shape: request_shape.to_string(),
        reference_count: references.len(),
        reference_roles: references
            .iter()
            .filter_map(|reference| reference.role.clone())
            .collect(),
        reference_fields,
        is_image_to_image,
    }
}

fn is_supported_image_to_image_adapter(adapter: &str) -> bool {
    matches!(
        adapter,
        "openai-images-edit" | "responses-input-image" | "chat-image-url" | "json-image-array"
    )
}

fn protocol_mapping_raw(mapping: &ImageToImageProtocolMapping) -> Value {
    serde_json::json!({
        "generation_mode": &mapping.generation_mode,
        "image_to_image_adapter": &mapping.image_to_image_adapter,
        "protocol": &mapping.protocol,
        "endpoint_path": &mapping.endpoint_path,
        "reference_count": mapping.reference_count,
        "reference_roles": &mapping.reference_roles,
        "request_shape": &mapping.request_shape,
        "reference_fields": &mapping.reference_fields
    })
}

fn request_options_raw(request: &OpenAIImageRequest) -> Value {
    serde_json::json!({
        "count": request.count.max(1).min(4),
        "size": &request.size,
        "quality": &request.quality,
        "negative_prompt": request.negative_prompt.as_deref().unwrap_or(""),
        "seed": request.seed,
        "output_format": &request.output_format,
        "output_compression": request.output_compression
    })
}

fn with_protocol_mapping_raw(raw: Value, mapping: &ImageToImageProtocolMapping, request: &OpenAIImageRequest) -> Value {
    match raw {
        Value::Object(mut map) => {
            map.insert(
                "visionhub_protocol_mapping".to_string(),
                protocol_mapping_raw(mapping),
            );
            map.insert(
                "visionhub_request_options".to_string(),
                request_options_raw(request),
            );
            Value::Object(map)
        }
        other => serde_json::json!({
            "response": other,
            "visionhub_protocol_mapping": protocol_mapping_raw(mapping),
            "visionhub_request_options": request_options_raw(request)
        }),
    }
}

fn normalize_openai_image_size_for_base_url(base_url: &str, requested_size: &str) -> String {
    if !base_url.eq_ignore_ascii_case("https://api.openai.com") {
        return requested_size.to_string();
    }

    match requested_size.trim() {
        "auto" | "1024x1024" | "1536x1024" | "1024x1536" => requested_size.trim().to_string(),
        other => {
            let Some((width, height)) = parse_image_size(other) else {
                return "1024x1024".to_string();
            };
            if width > height {
                "1536x1024".to_string()
            } else if height > width {
                "1024x1536".to_string()
            } else {
                "1024x1024".to_string()
            }
        }
    }
}

fn parse_image_size(size: &str) -> Option<(u32, u32)> {
    let (width, height) = size.trim().split_once('x')?;
    let width = width.trim().parse::<u32>().ok()?;
    let height = height.trim().parse::<u32>().ok()?;
    Some((width, height))
}

async fn poll_background_response(
    client: &reqwest::Client,
    base_url: &str,
    endpoint_path: &str,
    api_key: &str,
    extra_headers: Option<&std::collections::HashMap<String, String>>,
    initial_raw: Value,
) -> Result<Value, String> {
    let Some(response_id) = extract_response_id(&initial_raw) else {
        return Ok(initial_raw);
    };

    if !should_poll_response(&initial_raw) {
        return Ok(initial_raw);
    }

    let retrieve_url = responses_retrieve_url(base_url, endpoint_path, &response_id);
    for _ in 0..96 {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        let mut builder = client.get(&retrieve_url).bearer_auth(api_key);
        if let Some(headers) = extra_headers {
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
            .map_err(|error| format!("Cannot poll Responses background task: {error}"))?;
        let status = response.status();
        let body_text = response
            .text()
            .await
            .map_err(|error| format!("Cannot read Responses background task: {error}"))?;
        let raw: Value = serde_json::from_str(&body_text).map_err(|error| {
            let preview: String = body_text.chars().take(600).collect();
            format!(
                "后台任务轮询响应不是 JSON：{error}. HTTP {status}. 响应预览：{preview}"
            )
        })?;

        if !status.is_success() {
            return Err(format_openai_compatible_error(
                status.as_u16(),
                extract_error_message(&raw).as_deref(),
                None,
                None,
                None,
            ));
        }

        if !extract_image_urls(&raw, None).is_empty() {
            return Ok(raw);
        }

        match extract_response_status(&raw).as_deref() {
            Some("queued") | Some("in_progress") => {}
            Some("completed") | Some("failed") | Some("cancelled") | Some("incomplete") => {
                return Ok(raw);
            }
            _ => return Ok(raw),
        }
    }

    Err("Responses 后台任务轮询超时：上游生成时间超过 8 分钟，软件没有拿到最终图片。".to_string())
}

fn responses_retrieve_url(base_url: &str, endpoint_path: &str, response_id: &str) -> String {
    let endpoint_path = endpoint_path.trim_end_matches('/');
    format!("{base_url}{endpoint_path}/{response_id}")
}

fn responses_poll_error_raw(
    initial_raw: Value,
    base_url: &str,
    endpoint_path: &str,
    error: &str,
) -> Value {
    let response_id = extract_response_id(&initial_raw);
    let retrieve_url = response_id
        .as_deref()
        .map(|id| responses_retrieve_url(base_url, endpoint_path, id));

    serde_json::json!({
        "initial_response": initial_raw,
        "poll_error": error,
        "poll_url": retrieve_url,
        "poll_endpoint_path": endpoint_path,
        "response_id": response_id
    })
}

fn extract_background_poll_url(raw: &Value) -> Option<String> {
    raw.get("poll_url")
        .and_then(Value::as_str)
        .or_else(|| raw.pointer("/visionhub_recovery/poll_url").and_then(Value::as_str))
        .filter(|url| !url.trim().is_empty())
        .map(|url| url.trim().to_string())
}

fn extract_response_id(raw: &Value) -> Option<String> {
    raw.get("id")
        .and_then(|id| id.as_str())
        .filter(|id| !id.trim().is_empty())
        .map(|id| id.to_string())
}

fn extract_response_status(raw: &Value) -> Option<String> {
    raw.get("status")
        .and_then(|status| status.as_str())
        .map(|status| status.to_string())
}

fn should_poll_response(raw: &Value) -> bool {
    if !extract_image_urls(raw, None).is_empty() {
        return false;
    }

    matches!(
        extract_response_status(raw).as_deref(),
        Some("queued") | Some("in_progress")
    )
}

fn without_responses_background(mut payload: Value) -> Value {
    if let Value::Object(map) = &mut payload {
        map.remove("background");
        map.remove("store");
    }
    payload
}

fn response_body_mentions_background_unsupported(body_text: &str) -> bool {
    let lower = body_text.to_ascii_lowercase();
    lower.contains("background")
        && (lower.contains("unsupported")
            || lower.contains("unknown")
            || lower.contains("unrecognized")
            || lower.contains("invalid")
            || lower.contains("not support")
            || lower.contains("does not support")
            || lower.contains("不能")
            || lower.contains("不支持"))
}

fn extract_http_status_hint(raw: &Value) -> Option<u16> {
    raw.get("http_status")
        .and_then(|status| status.as_u64())
        .and_then(|status| u16::try_from(status).ok())
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
    protocol_mapping: Option<&ImageToImageProtocolMapping>,
) -> String {
    let lower_message = json_message.unwrap_or("").to_ascii_lowercase();
    let prefix = if lower_message.contains("billing hard limit") {
        "账单硬限制：OpenAI 官方项目已达到 Billing hard limit，需要在 OpenAI 控制台检查额度、付款方式或项目用量上限。"
    } else {
        match status_code {
            401 => "认证失败：API Key 无效、过期，或中转站没有接受当前密钥。",
            403 => "权限不足：当前 Key/账号可能没有该模型或图片接口权限。",
            404 => "接口不存在：请检查 Base URL、协议类型和接口路径。",
            408 | 524 => "同步连接超时：中转站或上游生图服务等待太久后断开，后台可能仍会继续生成。",
            429 => "请求受限：可能是余额不足、频率限制或并发限制。",
            500..=599 => "供应商/中转站服务异常：上游没有正常返回生图结果。",
            _ => "生图接口没有返回有效图片。",
        }
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
    if matches!(status_code, 408 | 524) {
        parts.push("这通常不是配置错误；如果中转站记录显示后续成功，说明同步连接先超时了。建议重启新版程序后重试后台轮询，或降低尺寸/数量后再试。".to_string());
    }
    if matches!(status_code, 400 | 404 | 422) {
        if let Some(mapping) = protocol_mapping.filter(|mapping| mapping.is_image_to_image) {
            parts.push(format!(
                "当前图生图映射为 {}，请求形态 {}，参考图字段 {}；如果服务商不支持这种字段结构，请在平台接入里切换“图生图映射”或调整协议/接口路径。",
                mapping.image_to_image_adapter,
                mapping.request_shape,
                mapping.reference_fields.join(", ")
            ));
        }
    }
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
    let mode = prompt_polish_mode_rules(&request.mode_id);
    let style = prompt_style_rules(request.style_id.as_deref().unwrap_or("auto"));
    let style_rule = if style.is_empty() {
        "".to_string()
    } else {
        format!("当前风格规则：{style}")
    };

    format!(
        "你是专业 AI 图像提示词编辑器，不是普通文本改写助手。你的任务是把用户原始提示词重写成更适合文生图/图生图的可执行提示词。硬性要求：{language}{strength}当前模式规则：{mode}{style_rule} 必须重组原提示词，形成完整画面方案，禁止只在原句后面追加一句泛泛的质量词。输出必须覆盖主体、场景、构图/镜头、光线、材质、色彩、画质、约束中的至少 6 类信息；短提示词要主动扩展到可直接生成的画面描述。保留用户明确指定的主体、人物特征、服装、颜色、物体和限制，不要编造冲突信息，不要引入具体艺术家、真实品牌或版权角色，除非原文已经明确要求。只输出最终提示词正文，不要解释，不要 Markdown，不要加标题，不要复述规则。"
    )
}

fn build_prompt_polish_payload(request: &PromptPolishRequest, protocol: &str, instruction: &str) -> Value {
    let mode_rules = prompt_polish_mode_rules(&request.mode_id);
    let strength_rules = prompt_polish_strength_rules(&request.strength);
    let style_rules = prompt_style_rules(request.style_id.as_deref().unwrap_or("auto"));
    let user_content = format!(
        "请按以下规则重写原始提示词。\n\n当前润色模式：{}\n模式规则：{}\n强度规则：{}\n风格规则：{}\n输出要求：只输出一段完整的最终生图提示词；不要把原文原样放在开头再追加一句；必须把原文拆解并重组为主体、场景、构图/镜头、光线、材质、色彩、画质、约束明确的画面方案；如果原文少于 20 个字，要扩写到可直接用于生成的丰富画面描述；不要输出说明文字。\n\n原始提示词：\n{}",
        prompt_polish_mode_label(&request.mode_id),
        mode_rules,
        strength_rules,
        if style_rules.is_empty() { "不额外限定画风，按原始需求自然处理。" } else { style_rules },
        request.prompt.trim()
    );
    match protocol {
        "responses" => serde_json::json!({
            "model": request.model_id,
            "input": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": user_content }
            ],
            "temperature": 0.7
        }),
        _ => serde_json::json!({
            "model": request.model_id,
            "messages": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": user_content }
            ],
            "temperature": 0.7
        }),
    }
}

fn ensure_prompt_polish_changed(source: &str, polished: &str, mode_id: &str) -> String {
    let cleaned = polished.trim().trim_matches('"').trim();
    let source_normalized = normalize_prompt_for_similarity(source);
    let polished_normalized = normalize_prompt_for_similarity(cleaned);
    let source_len = source.trim().chars().count();
    let min_extra = if source_len < 20 { 42 } else { 18 };
    let too_similar = cleaned.chars().count() < source_len + min_extra
        || source_normalized == polished_normalized;
    if !too_similar {
        return cleaned.to_string();
    }

    let fallback_additions = match mode_id {
        "smart-expand" => "主体设定更完整，场景背景清晰，动作姿态自然，镜头视角明确，光线氛围丰富，色彩层次协调，细节充足，适合 AI 图像生成",
        "conservative" => "保留原始主体和核心意图，补齐必要场景、稳定构图、自然光线、清晰材质和干净画质，不添加冲突元素",
        "pro-image-prompt" => "主体、环境、构图、镜头、光线、材质、色彩和画质要求完整，提示词结构清晰，可直接用于专业 AI 图像生成",
        "poster-kv" => "主视觉构图，主体突出，背景层次丰富，适合海报和封面，预留文字空间，商业级光影，高级配色，传播感强",
        "character-design" => "角色外观清晰，服装材质细节丰富，姿态有表现力，性格气质明确，背景服务角色设定，电影感灯光，高细节",
        "product-photo" => "产品主体突出，材质真实，棚拍灯光，干净背景，边缘高光清晰，柔和阴影，高级商业摄影质感",
        "image-to-image" => "以参考图为基础，保留主体轮廓、核心身份、主要构图和关键材质，只改变用户要求调整的风格、场景、光影或细节",
        "game-asset" => "主体轮廓清晰，居中展示，适合游戏资产，材质统一，高可读性，干净背景，无文字、无 Logo、无水印",
        "world-scene" => "宏观场景层次丰富，前景中景远景明确，世界观细节充足，空间纵深强，氛围光影明确，电影级概念图",
        "ecommerce-detail" => "商品卖点突出，材质纹理清晰，局部特写细节，干净构图，电商详情页视觉，高级质感，信息表达明确",
        "social-cover" => "封面视觉焦点明确，构图抓人，色彩醒目但协调，适合社媒传播，画面干净，高辨识度，高质量细节",
        "cinematic" => "电影级构图，镜头感明确，浅景深，体积光，高对比光影，氛围感强，视觉焦点清晰，画面层次丰富",
        "commercial" | "poster-kv-local" => "主体突出，商业级质感，干净背景，高级配色，棚拍灯光，精致细节，可用于宣传物料",
        "platform-cn" => "画面主体明确，场景描述清晰，风格关键词完整，构图要求明确，光线自然，高清细节，适合中文 AI 图像生成平台",
        _ => "主体细节清晰，场景层次丰富，材质真实，光影自然，构图稳定，高细节，画面干净，主题明确，适合 AI 图像生成",
    };
    format!(
        "主体：{}，核心特征明确；画面：{}；构图：视觉焦点稳定，主体与背景层次清楚；光影：主光方向明确，明暗关系自然；材质：关键纹理和边缘细节可见；色彩：主色协调，氛围统一；质量：高清细节，画面干净，适合 AI 图像生成。",
        source.trim(),
        fallback_additions
    )
}

fn normalize_prompt_for_similarity(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_whitespace() && !"，。,.、；;：:！!？?\"'“”‘’（）()[]【】".contains(*ch))
        .collect::<String>()
        .to_lowercase()
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

fn default_inspiration_images_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("inspirations").join("images");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create default inspiration images directory: {error}"))?;
    Ok(dir)
}

fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = read_storage_settings(app)?;
    let dir = match settings
        .library_dir_override
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => resolve_storage_override(path, "图库目录")?,
        None => default_library_dir(app)?,
    };
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create local image library: {error}"))?;
    Ok(dir)
}

fn inspiration_images_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = read_storage_settings(app)?;
    let dir = match settings
        .inspiration_dir_override
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => resolve_storage_override(path, "图片收藏目录")?,
        None => default_inspiration_images_dir(app)?,
    };
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create inspiration images directory: {error}"))?;
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

fn library_meta_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("library-meta.json"))
}

fn inspirations_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("inspirations");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create inspirations directory: {error}"))?;
    Ok(dir)
}

fn inspiration_sources_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(inspirations_dir(app)?.join("inspiration-sources.json"))
}

fn inspiration_assets_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(inspirations_dir(app)?.join("inspiration-assets.json"))
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
    let default_inspiration_dir = default_inspiration_images_dir(app)?;
    let resolved_inspiration_dir = inspiration_images_dir(app)?;
    let settings_file = storage_settings_file_path(app)?;

    Ok(StorageSettings {
        library_dir_override: stored
            .library_dir_override
            .as_deref()
            .map(strip_windows_extended_path_prefix),
        inspiration_dir_override: stored
            .inspiration_dir_override
            .as_deref()
            .map(strip_windows_extended_path_prefix),
        default_library_dir: path_to_user_string(&default_library_dir),
        resolved_library_dir: path_to_user_string(&resolved_library_dir),
        default_inspiration_dir: path_to_user_string(&default_inspiration_dir),
        resolved_inspiration_dir: path_to_user_string(&resolved_inspiration_dir),
        settings_file: path_to_user_string(&settings_file),
    })
}

fn save_storage_dir_overrides(
    app: &tauri::AppHandle,
    library_override_path: Option<&str>,
    inspiration_override_path: Option<&str>,
) -> Result<StorageSettings, String> {
    let library_override_path = library_override_path
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let inspiration_override_path = inspiration_override_path
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let stored = StoredStorageSettings {
        library_dir_override: match library_override_path {
            Some(path) => Some(path_to_user_string(&resolve_storage_override(path, "图库目录")?)),
            None => None,
        },
        inspiration_dir_override: match inspiration_override_path {
            Some(path) => Some(path_to_user_string(&resolve_storage_override(path, "图片收藏目录")?)),
            None => None,
        },
    };
    write_storage_settings(app, &stored)?;
    storage_settings_response(app)
}

fn resolve_storage_override(path: &str, label: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(path.trim());
    if !dir.is_absolute() {
        return Err(format!("{label}必须是绝对路径，例如 D:\\VisionHub\\library。"));
    }
    if dir.is_file() {
        return Err(format!("{label}不能指向一个文件，请选择文件夹。"));
    }
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create custom storage directory: {error}"))?;
    dir.canonicalize()
        .map_err(|error| format!("Cannot resolve custom storage directory: {error}"))
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

fn prompt_polish_mode_label(mode_id: &str) -> &'static str {
    match mode_id {
        "smart-expand" => "智能扩写",
        "conservative" => "保守润色",
        "pro-image-prompt" => "生图专业版",
        "poster-kv" => "海报/KV",
        "character-design" => "角色设定",
        "product-photo" => "产品摄影/电商",
        "image-to-image" => "图生图改写",
        "game-asset" => "游戏资产",
        "world-scene" => "场景概念图",
        "ecommerce-detail" => "电商详情图",
        "social-cover" => "社媒封面",
        "standard" => "标准重写",
        "detail" => "细节扩写",
        "cinematic" => "电影感",
        "commercial" => "商业视觉",
        "platform-cn" => "中文平台",
        _ => "更详细",
    }
}

fn prompt_polish_mode_rules(mode_id: &str) -> &'static str {
    match mode_id {
        "smart-expand" => "适合短句和笼统想法。主动补全画面主体、场景、动作、镜头、光线、色彩、质感和画质，不要停留在关键词堆砌。",
        "conservative" => "保守补全原意。不得改变主体、数量、身份、关键颜色和用户限制；只补齐必要的场景、构图、光线、材质和画质信息。",
        "pro-image-prompt" => "整理成专业生图提示词，结构应覆盖主体、环境、构图、镜头、光线、材质、色彩、氛围和质量要求，可直接复制到文生图或图生图模型。",
        "poster-kv" => "面向海报、活动 KV、封面和品牌主视觉。强化主体层级、视觉焦点、背景空间、商业质感、传播感和可放标题的构图空间。",
        "character-design" => "面向人物或角色。扩写身份气质、外观特征、服装材质、姿态动作、表情、场景关系、镜头距离和氛围光。",
        "product-photo" => "面向产品摄影和商品主图。扩写产品形态、材质纹理、棚拍布光、阴影、高光、背景、摆放方式和高级商业质感。",
        "image-to-image" => "面向图生图。围绕参考图改写，明确哪些要保留、哪些要改变；优先写清参考一致性、构图保留、风格迁移、局部变化和质量提升。",
        "game-asset" => "面向游戏资产。强调清晰轮廓、居中展示、小尺寸可读性、材质统一、干净背景、可切图复用，并避免文字、Logo、水印。",
        "world-scene" => "面向场景概念图。扩写空间层次、前中远景、地貌/建筑/道具、时间天气、氛围光、尺度感和世界观细节。",
        "ecommerce-detail" => "面向电商详情图。扩写商品卖点、局部特写、材质细节、使用场景、干净背景、信息表达和高转化视觉。",
        "social-cover" => "面向社媒封面。扩写强视觉焦点、清晰主体、醒目色彩、简洁背景、动态感、封面辨识度和移动端可读性。",
        "standard" => "重写为标准生图提示词，补全主体、场景、构图、光线、材质、色彩和画质，保持原意清晰。",
        "detail" => "显著扩写主体细节、场景层次、材质纹理、光影关系、镜头视角、色彩氛围和质量要求。",
        "cinematic" => "强化电影级构图、镜头焦段、景深、光影对比、氛围叙事和视觉焦点，可加入 cinematic lighting、depth of field、wide shot/close-up 等等效描述。",
        "commercial" => "强化主体质感、干净背景、产品/人物展示感、商业棚拍灯光、高级配色、可用于宣传物料的清晰构图。",
        "platform-cn" => "使用清晰中文短句和逗号分隔的关键词，避免抽象空泛词，明确主体、动作、场景、风格、构图、光线和画质要求。",
        _ => "补充主体外观、年龄/身份/姿态、场景背景、材质纹理、光线方向、构图方式、画面质量和适合 AI 生图的关键词。",
    }
}

fn prompt_polish_strength_rules(strength: &str) -> &'static str {
    match strength {
        "concise" => "简洁增强，控制在 1 段内，只补关键缺失信息。",
        "detailed" => "细节扩写，补充更完整的画面要素，允许显著增加描述密度。",
        "cinematic" => "偏电影感，优先补镜头、光影、景深、色调和氛围。",
        "commercial" => "偏商业视觉，优先补主体质感、干净背景、灯光、构图和交付质感。",
        _ => "专业生图提示词，整理成结构清晰、信息完整、可直接用于 AI 图像生成的一段提示词。",
    }
}

fn prompt_style_rules(style_id: &str) -> &'static str {
    match style_id {
        "photorealistic" => "按写实摄影风格处理：真实镜头感、自然光线、真实材质和高可信度细节。",
        "cinematic" => "按电影感视觉处理：镜头叙事、体积光、浅景深、高级调色和明确画面焦点。",
        "commercial" => "按商业广告视觉处理：主体突出、干净高级背景、精致布光和品牌质感。",
        "product-photo" => "按产品摄影处理：棚拍布光、清晰边缘高光、真实材质、柔和阴影和电商可交付感。",
        "anime" => "按二次元动漫画风处理：清晰线条、精致角色设计、明快色彩和高完成度插画。",
        "chinese-illustration" => "按国风插画处理：东方审美、传统纹样、细腻线条、雅致配色和国潮视觉。",
        "ink-wash" => "按水墨国风处理：宣纸质感、墨色层次、留白构图、东方意境和淡雅色彩。",
        "watercolor" => "按水彩插画处理：透明叠色、柔和边缘、手绘纸张质感和轻盈氛围。",
        "oil-painting" => "按油画质感处理：厚重笔触、画布纹理、丰富色层和艺术绘画感。",
        "concept-art" => "按厚涂概念设计处理：体积感强、材质清晰、概念艺术完成度高，适合设定图。",
        "three-d-render" => "按高质量 3D 渲染处理：真实材质、精致模型、干净灯光和清晰体积感。",
        "flat-vector" => "按扁平矢量插画处理：几何形状、干净边界、简洁配色和高可读性。",
        "ui-icon" => "按现代 UI 图标处理：居中构图、简洁轮廓、小尺寸可读，无文字、无水印。",
        "game-asset" => "按游戏资产美术处理：清晰轮廓、居中展示、高可读性、材质统一和干净背景。",
        "pixel-art" => "按像素艺术处理：清晰像素块、复古游戏视觉、有限色板和高辨识轮廓。",
        "line-art" => "按线稿漫画处理：清晰黑白线条、干净轮廓、漫画构图，适合后续上色。",
        "cyberpunk" => "按赛博朋克视觉处理：霓虹灯光、未来城市、高对比色彩和科技氛围。",
        "retro-film" => "按复古胶片摄影处理：柔和颗粒、怀旧色调、自然曝光和真实生活感。",
        "minimal-premium" => "按极简高级视觉处理：大面积留白、克制配色、干净构图和高级品牌感。",
        _ => "",
    }
}

fn pick_image_files_with_system_dialog() -> Result<Vec<PathBuf>, String> {
    #[cfg(target_os = "windows")]
    {
        const MAX_FILE_BUFFER: usize = 65536;
        const OFN_ALLOWMULTISELECT: u32 = 0x00000200;
        const OFN_EXPLORER: u32 = 0x00080000;
        const OFN_FILEMUSTEXIST: u32 = 0x00001000;
        const OFN_PATHMUSTEXIST: u32 = 0x00000800;

        #[repr(C)]
        struct OpenFileNameW {
            l_struct_size: u32,
            hwnd_owner: *mut c_void,
            h_instance: *mut c_void,
            lpstr_filter: *const u16,
            lpstr_custom_filter: *mut u16,
            n_max_cust_filter: u32,
            n_filter_index: u32,
            lpstr_file: *mut u16,
            n_max_file: u32,
            lpstr_file_title: *mut u16,
            n_max_file_title: u32,
            lpstr_initial_dir: *const u16,
            lpstr_title: *const u16,
            flags: u32,
            n_file_offset: u16,
            n_file_extension: u16,
            lpstr_def_ext: *const u16,
            l_cust_data: isize,
            lpfn_hook: Option<unsafe extern "system" fn()>,
            lp_template_name: *const u16,
            pv_reserved: *mut c_void,
            dw_reserved: u32,
            flags_ex: u32,
        }

        #[link(name = "comdlg32")]
        unsafe extern "system" {
            fn GetOpenFileNameW(param: *mut OpenFileNameW) -> i32;
        }

        let filter: Vec<u16> = "图片文件\0*.png;*.jpg;*.jpeg;*.webp;*.gif;*.svg\0所有文件\0*.*\0\0"
            .encode_utf16()
            .collect();
        let title: Vec<u16> = "导入本地图片到 VisionHub 作品画廊\0"
            .encode_utf16()
            .collect();
        let mut file_buffer = vec![0u16; MAX_FILE_BUFFER];
        let mut open_file_name = OpenFileNameW {
            l_struct_size: std::mem::size_of::<OpenFileNameW>() as u32,
            hwnd_owner: std::ptr::null_mut(),
            h_instance: std::ptr::null_mut(),
            lpstr_filter: filter.as_ptr(),
            lpstr_custom_filter: std::ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buffer.as_mut_ptr(),
            n_max_file: file_buffer.len() as u32,
            lpstr_file_title: std::ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: std::ptr::null(),
            lpstr_title: title.as_ptr(),
            flags: OFN_ALLOWMULTISELECT | OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: std::ptr::null(),
            l_cust_data: 0,
            lpfn_hook: None,
            lp_template_name: std::ptr::null(),
            pv_reserved: std::ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetOpenFileNameW(&mut open_file_name) };
        if ok == 0 {
            return Ok(Vec::new());
        }

        let mut parts = Vec::new();
        let mut start = 0;
        for index in 0..file_buffer.len() {
            if file_buffer[index] == 0 {
                if index == start {
                    break;
                }
                parts.push(String::from_utf16_lossy(&file_buffer[start..index]));
                start = index + 1;
            }
        }

        if parts.is_empty() {
            return Ok(Vec::new());
        }
        if parts.len() == 1 {
            return Ok(vec![PathBuf::from(&parts[0])]);
        }

        let dir = PathBuf::from(&parts[0]);
        Ok(parts.into_iter().skip(1).map(|name| dir.join(name)).collect())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("当前平台暂未接入系统图片选择窗口。".to_string())
    }
}

fn pick_save_markdown_file_with_system_dialog(suggested_file_name: &str) -> Result<Option<PathBuf>, String> {
    #[cfg(target_os = "windows")]
    {
        const MAX_FILE_BUFFER: usize = 32768;
        const OFN_OVERWRITEPROMPT: u32 = 0x00000002;
        const OFN_PATHMUSTEXIST: u32 = 0x00000800;
        const OFN_EXPLORER: u32 = 0x00080000;

        #[repr(C)]
        struct OpenFileNameW {
            l_struct_size: u32,
            hwnd_owner: *mut c_void,
            h_instance: *mut c_void,
            lpstr_filter: *const u16,
            lpstr_custom_filter: *mut u16,
            n_max_cust_filter: u32,
            n_filter_index: u32,
            lpstr_file: *mut u16,
            n_max_file: u32,
            lpstr_file_title: *mut u16,
            n_max_file_title: u32,
            lpstr_initial_dir: *const u16,
            lpstr_title: *const u16,
            flags: u32,
            n_file_offset: u16,
            n_file_extension: u16,
            lpstr_def_ext: *const u16,
            l_cust_data: isize,
            lpfn_hook: Option<unsafe extern "system" fn()>,
            lp_template_name: *const u16,
            pv_reserved: *mut c_void,
            dw_reserved: u32,
            flags_ex: u32,
        }

        #[link(name = "comdlg32")]
        unsafe extern "system" {
            fn GetSaveFileNameW(param: *mut OpenFileNameW) -> i32;
        }

        let filter: Vec<u16> = "Markdown 文件\0*.md\0文本文件\0*.txt\0所有文件\0*.*\0\0"
            .encode_utf16()
            .collect();
        let title: Vec<u16> = "导出 VisionHub 作品画廊记录清单\0"
            .encode_utf16()
            .collect();
        let default_ext: Vec<u16> = "md\0".encode_utf16().collect();
        let mut file_buffer = vec![0u16; MAX_FILE_BUFFER];
        for (index, code_unit) in suggested_file_name.encode_utf16().take(MAX_FILE_BUFFER - 1).enumerate() {
            file_buffer[index] = code_unit;
        }

        let mut open_file_name = OpenFileNameW {
            l_struct_size: std::mem::size_of::<OpenFileNameW>() as u32,
            hwnd_owner: std::ptr::null_mut(),
            h_instance: std::ptr::null_mut(),
            lpstr_filter: filter.as_ptr(),
            lpstr_custom_filter: std::ptr::null_mut(),
            n_max_cust_filter: 0,
            n_filter_index: 1,
            lpstr_file: file_buffer.as_mut_ptr(),
            n_max_file: file_buffer.len() as u32,
            lpstr_file_title: std::ptr::null_mut(),
            n_max_file_title: 0,
            lpstr_initial_dir: std::ptr::null(),
            lpstr_title: title.as_ptr(),
            flags: OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_EXPLORER,
            n_file_offset: 0,
            n_file_extension: 0,
            lpstr_def_ext: default_ext.as_ptr(),
            l_cust_data: 0,
            lpfn_hook: None,
            lp_template_name: std::ptr::null(),
            pv_reserved: std::ptr::null_mut(),
            dw_reserved: 0,
            flags_ex: 0,
        };

        let ok = unsafe { GetSaveFileNameW(&mut open_file_name) };
        if ok == 0 {
            return Ok(None);
        }

        let end = file_buffer.iter().position(|code_unit| *code_unit == 0).unwrap_or(file_buffer.len());
        if end == 0 {
            return Ok(None);
        }

        Ok(Some(PathBuf::from(String::from_utf16_lossy(&file_buffer[..end]))))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = suggested_file_name;
        Err("当前平台暂未接入保存位置选择窗口。".to_string())
    }
}

fn sanitize_save_file_name(file_name: &str, fallback: &str) -> String {
    let sanitized: String = file_name
        .trim()
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => ch,
        })
        .collect();
    let trimmed = sanitized.trim_matches(&[' ', '.'][..]).to_string();
    if trimmed.is_empty() {
        fallback.to_string()
    } else if Path::new(&trimmed).extension().is_none() {
        format!("{trimmed}.md")
    } else {
        trimmed
    }
}

fn scan_image_files_in_folder(folder: &Path) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();
    let entries = std::fs::read_dir(folder)
        .map_err(|error| format!("Cannot read selected folder: {error}"))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("Cannot read selected folder entry: {error}"))?;
        let path = entry.path();
        if path.is_file() && is_supported_image_path(&path) {
            paths.push(path);
        }
    }
    paths.sort();
    Ok(paths)
}

fn is_supported_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "svg")
    )
}

fn is_supported_reference_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp")
    )
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
    let mut storage_records = records.to_vec();
    for record in &mut storage_records {
        if !record.local_image_paths.is_empty() {
            record.image_urls.retain(|url| !url.starts_with("data:image/"));
        }
    }
    let text = serde_json::to_string_pretty(&storage_records)
        .map_err(|error| format!("Cannot serialize generation history: {error}"))?;
    std::fs::write(&tmp_path, text)
        .map_err(|error| format!("Cannot write generation history: {error}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Cannot replace generation history: {error}"))?;
    Ok(())
}

fn read_inspiration_sources(app: &tauri::AppHandle) -> Result<Vec<InspirationSource>, String> {
    let path = inspiration_sources_file_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read inspiration sources: {error}"))?;
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }
    let mut sources: Vec<InspirationSource> = serde_json::from_str(&text)
        .map_err(|error| format!("Cannot parse inspiration sources: {error}"))?;
    sources.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sources)
}

fn write_inspiration_sources(
    app: &tauri::AppHandle,
    sources: &[InspirationSource],
) -> Result<(), String> {
    let path = inspiration_sources_file_path(app)?;
    let tmp_path = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(sources)
        .map_err(|error| format!("Cannot serialize inspiration sources: {error}"))?;
    std::fs::write(&tmp_path, text)
        .map_err(|error| format!("Cannot write inspiration sources: {error}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Cannot replace inspiration sources: {error}"))?;
    Ok(())
}

fn read_inspiration_assets(app: &tauri::AppHandle) -> Result<Vec<InspirationAsset>, String> {
    let path = inspiration_assets_file_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read inspiration assets: {error}"))?;
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }
    let mut assets: Vec<InspirationAsset> = serde_json::from_str(&text)
        .map_err(|error| format!("Cannot parse inspiration assets: {error}"))?;
    assets.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(assets)
}

fn write_inspiration_assets(
    app: &tauri::AppHandle,
    assets: &[InspirationAsset],
) -> Result<(), String> {
    let path = inspiration_assets_file_path(app)?;
    let tmp_path = path.with_extension("json.tmp");
    let mut persisted = assets.to_vec();
    for asset in &mut persisted {
        if asset.image_path.is_some() && asset.image_url.as_deref().is_some_and(|url| url.starts_with("data:image/")) {
            asset.image_url = None;
        }
    }
    let text = serde_json::to_string_pretty(&persisted)
        .map_err(|error| format!("Cannot serialize inspiration assets: {error}"))?;
    std::fs::write(&tmp_path, text)
        .map_err(|error| format!("Cannot write inspiration assets: {error}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Cannot replace inspiration assets: {error}"))?;
    Ok(())
}

fn hydrate_inspiration_asset_image_url(app: &tauri::AppHandle, asset: &mut InspirationAsset) {
    let Some(path) = asset.image_path.as_deref() else {
        return;
    };
    if let Ok(image_url) = inspiration_image_path_to_data_url(app, path) {
        asset.image_url = Some(image_url);
    }
}

fn inspiration_image_path_to_data_url(app: &tauri::AppHandle, path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    if !is_allowed_inspiration_image_path(app, &file_path)? {
        return Err("Image path is outside the current VisionHub inspiration scope.".to_string());
    }
    let bytes = std::fs::read(&file_path)
        .map_err(|error| format!("Cannot read inspiration image: {error}"))?;
    let mime = image_mime_from_path(&file_path);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

fn is_allowed_inspiration_image_path(app: &tauri::AppHandle, path: &Path) -> Result<bool, String> {
    let file = path
        .canonicalize()
        .map_err(|error| format!("Cannot resolve inspiration image path: {error}"))?;
    if !file.is_file() {
        return Ok(false);
    }
    let root = inspiration_images_dir(app)?
        .canonicalize()
        .map_err(|error| format!("Cannot resolve inspiration image directory: {error}"))?;
    let default_root = default_inspiration_images_dir(app)?
        .canonicalize()
        .map_err(|error| format!("Cannot resolve default inspiration image directory: {error}"))?;
    Ok(file.starts_with(root) || file.starts_with(default_root))
}

fn optional_trimmed_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn clean_string_list(values: Vec<String>) -> Vec<String> {
    let mut cleaned = Vec::new();
    for value in values {
        let value = value.trim().to_string();
        if !value.is_empty() && !cleaned.contains(&value) {
            cleaned.push(value);
        }
    }
    cleaned
}

fn hydrate_record_image_urls(app: &tauri::AppHandle, record: &mut GenerationRecord) -> bool {
    let mut changed = false;
    if record.local_image_paths.is_empty() {
        let recovered_urls = if record.image_urls.is_empty() {
            extract_image_urls(&record.raw, None)
        } else {
            record.image_urls.clone()
        };

        if !recovered_urls.is_empty() {
            let local_paths = save_data_url_images_to_library(
                app,
                &recovered_urls,
                &record.provider_id,
                &record.model_id,
            )
            .unwrap_or_default();

            if !local_paths.is_empty() {
                record.local_image_paths = local_paths;
                record.image_urls = display_image_urls_for_paths(app, record, &[]);
                changed = true;
            } else if record.image_urls.is_empty() {
                record.image_urls = recovered_urls;
                changed = true;
            }

            if record.status != "succeeded" || record.error.is_some() {
                record.status = "succeeded".to_string();
                record.error = None;
                changed = true;
            }
            if record.cost_hint.is_none() {
                record.cost_hint = Some("以 OpenAI 实际账单为准".to_string());
                changed = true;
            }
        }
        return changed;
    }

    let image_urls = display_image_urls_for_paths(app, record, &record.image_urls);
    if !image_urls.is_empty() {
        record.image_urls = image_urls;
        changed = true;
    }
    changed
}

fn display_image_urls_for_paths(
    app: &tauri::AppHandle,
    record: &GenerationRecord,
    fallback_urls: &[String],
) -> Vec<String> {
    if record.local_image_paths.is_empty() {
        return fallback_urls.to_vec();
    }

    let is_local_import = record.provider_id == "local-import"
        || record.raw.get("visionhubSource").and_then(Value::as_str) == Some("local-import");
    let display_urls: Vec<String> = record.local_image_paths
        .iter()
        .filter_map(|path| {
            if is_local_import {
                imported_image_path_to_data_url(path).ok()
            } else {
                local_image_path_to_data_url(app, path).ok()
            }
        })
        .collect();

    if display_urls.is_empty() {
        fallback_urls.to_vec()
    } else {
        display_urls
    }
}

fn display_library_image_urls_for_paths(
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

    image_path_to_data_url(&file_path, "generated")
}

fn imported_image_path_to_data_url(path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    if !file_path.is_file() || !is_supported_image_path(&file_path) {
        return Err("Imported image path is not a supported image file.".to_string());
    }
    image_path_to_data_url(&file_path, "imported")
}

fn image_path_to_data_url(file_path: &Path, label: &str) -> Result<String, String> {
    let bytes = std::fs::read(&file_path)
        .map_err(|error| format!("Cannot read {label} image: {error}"))?;
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
    request: &OpenAIImageRequest,
) -> Result<Vec<String>, String> {
    let dir = library_dir(app)?;
    let client = reqwest::Client::new();
    let mut saved_paths = Vec::new();

    for (index, image_url) in image_urls.iter().enumerate() {
        let (bytes, source_extension) = if image_url.starts_with("data:image/") {
            decode_data_url_image(image_url)?
        } else if image_url.starts_with("http://") || image_url.starts_with("https://") {
            download_remote_image(&client, image_url).await?
        } else {
            continue;
        };
        let (bytes, extension) = convert_generated_image_bytes(
            bytes,
            &source_extension,
            request.output_format.as_deref(),
            request.output_compression,
        )?;

        let filename = format!(
            "{}-{}-{}-{}.{}",
            chrono_like_timestamp_millis(),
            sanitize_filename(&request.provider_id),
            sanitize_filename(&request.model_id),
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

fn save_data_url_images_to_library(
    app: &tauri::AppHandle,
    image_urls: &[String],
    provider_id: &str,
    model_id: &str,
) -> Result<Vec<String>, String> {
    let dir = library_dir(app)?;
    let mut saved_paths = Vec::new();

    for (index, image_url) in image_urls.iter().enumerate() {
        if !image_url.starts_with("data:image/") {
            continue;
        }
        let (bytes, extension) = decode_data_url_image(image_url)?;
        let filename = format!(
            "{}-{}-{}-recovered-{}.{}",
            chrono_like_timestamp_millis(),
            sanitize_filename(provider_id),
            sanitize_filename(model_id),
            index + 1,
            extension
        );
        let path = dir.join(filename);
        std::fs::write(&path, bytes)
            .map_err(|error| format!("Cannot save recovered generated image: {error}"))?;
        saved_paths.push(path_to_user_string(&path));
    }

    Ok(saved_paths)
}

fn normalize_output_format(value: Option<&str>) -> Option<&'static str> {
    match value.unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "jpeg" | "jpg" => Some("jpg"),
        "webp" => Some("webp"),
        "png" => Some("png"),
        _ => None,
    }
}

fn normalized_image_quality(compression: Option<u8>) -> u8 {
    compression.unwrap_or(96).clamp(75, 100)
}

fn convert_generated_image_bytes(
    bytes: Vec<u8>,
    source_extension: &str,
    output_format: Option<&str>,
    output_compression: Option<u8>,
) -> Result<(Vec<u8>, String), String> {
    let Some(target_extension) = normalize_output_format(output_format) else {
        return Ok((bytes, source_extension.to_string()));
    };
    if target_extension == source_extension && target_extension != "jpg" && target_extension != "webp" {
        return Ok((bytes, source_extension.to_string()));
    }
    if source_extension == "svg" {
        return Ok((bytes, source_extension.to_string()));
    }

    let image = image::load_from_memory(&bytes)
        .map_err(|error| format!("Cannot decode generated image for {target_extension} export: {error}"))?;
    let mut output = Vec::new();
    match target_extension {
        "jpg" => {
            let rgb = image.to_rgb8();
            let mut encoder = JpegEncoder::new_with_quality(&mut output, normalized_image_quality(output_compression));
            encoder
                .encode(&rgb, rgb.width(), rgb.height(), ColorType::Rgb8.into())
                .map_err(|error| format!("Cannot encode generated image as JPEG: {error}"))?;
        }
        "webp" => {
            let rgba = image.to_rgba8();
            let encoder = WebPEncoder::new_lossless(&mut output);
            encoder
                .encode(&rgba, rgba.width(), rgba.height(), ColorType::Rgba8.into())
                .map_err(|error| format!("Cannot encode generated image as WebP: {error}"))?;
        }
        "png" => {
            let rgba = image.to_rgba8();
            let encoder = PngEncoder::new(&mut output);
            encoder
                .write_image(&rgba, rgba.width(), rgba.height(), ColorType::Rgba8.into())
                .map_err(|error| format!("Cannot encode generated image as PNG: {error}"))?;
        }
        _ => return Ok((bytes, source_extension.to_string())),
    }
    Ok((output, target_extension.to_string()))
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
        "custom-images" => "/v1/images/generations",
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
    api_size: &str,
) -> Result<reqwest::multipart::Form, String> {
    if references.is_empty() {
        return Err("图生图需要先添加至少一张参考图。".to_string());
    }

    let mut form = reqwest::multipart::Form::new()
        .text("model", request.model_id.clone())
        .text("prompt", request.prompt.clone())
        .text("size", api_size.to_string())
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
        let field_name = if references.len() > 1 { "image[]" } else { "image" };
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

fn mime_from_output_format(output_format: Option<&str>) -> &'static str {
    match normalize_output_format(output_format) {
        Some("jpg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "image/png",
    }
}

fn image_generation_tool(request: &OpenAIImageRequest, api_size: &str) -> Value {
    serde_json::json!({
        "type": "image_generation",
        "size": api_size,
        "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
        "n": request.count.max(1).min(4)
    })
}

fn apply_advanced_request_options(mut payload: Value, request: &OpenAIImageRequest) -> Value {
    if request.provider_id != "custom-http-provider" {
        return payload;
    }
    if let Value::Object(map) = &mut payload {
        if let Some(seed) = request.seed {
            map.insert("seed".to_string(), serde_json::json!(seed));
        }
        if let Some(negative_prompt) = request
            .negative_prompt
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            map.insert(
                "negative_prompt".to_string(),
                serde_json::json!(negative_prompt),
            );
        }
    }
    payload
}

fn build_openai_compatible_payload(
    request: &OpenAIImageRequest,
    protocol: &str,
    api_size: &str,
    mapping: &ImageToImageProtocolMapping,
) -> Value {
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
    let is_image_to_image = mapping.is_image_to_image && !reference_data_urls.is_empty();

    if is_image_to_image {
        return apply_advanced_request_options(match mapping.image_to_image_adapter.as_str() {
            "responses-input-image" => {
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
                    "tools": [image_generation_tool(request, api_size)],
                    "background": true,
                    "store": true,
                    "size": api_size,
                    "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                    "n": request.count.max(1).min(4)
                })
            }
            "chat-image-url" => {
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
                    "size": api_size,
                    "n": request.count.max(1).min(4)
                })
            }
            _ => serde_json::json!({
                "model": request.model_id,
                "prompt": request.prompt,
                "image": reference_data_urls.first(),
                "images": reference_data_urls,
                "size": api_size,
                "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                "n": request.count.max(1).min(4)
            }),
        }, request);
    }

    apply_advanced_request_options(match protocol {
        "responses" => {
            serde_json::json!({
                "model": request.model_id,
                "input": request.prompt,
                "tools": [image_generation_tool(request, api_size)],
                "background": true,
                "store": true,
                "size": api_size,
                "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                "n": request.count.max(1).min(4)
            })
        }
        "chat-completions" => {
            serde_json::json!({
                "model": request.model_id,
                "messages": [
                    {
                        "role": "user",
                        "content": request.prompt
                    }
                ],
                "modalities": ["text", "image"],
                "size": api_size,
                "n": request.count.max(1).min(4)
            })
        }
        _ => {
            serde_json::json!({
                "model": request.model_id,
                "prompt": request.prompt,
                "size": api_size,
                "quality": request.quality.clone().unwrap_or_else(|| "auto".to_string()),
                "n": request.count.max(1).min(4)
            })
        }
    }, request)
}

fn extract_image_urls(raw: &Value, output_format: Option<&str>) -> Vec<String> {
    let mut urls = Vec::new();
    let default_mime = mime_from_output_format(output_format);
    collect_images_recursive(raw, &mut urls, default_mime);
    urls
}

fn normalize_minimax_image_size(requested_size: &str) -> String {
    let parts: Vec<&str> = requested_size.split('x').collect();
    if parts.len() != 2 {
        return "1024x1024".to_string();
    }
    let width = parts[0].trim().parse::<u32>().unwrap_or(1024).max(1);
    let height = parts[1].trim().parse::<u32>().unwrap_or(1024).max(1);
    format!("{width}x{height}")
}

fn minimax_aspect_ratio(size: &str) -> &'static str {
    let parts: Vec<&str> = size.split('x').collect();
    if parts.len() != 2 {
        return "1:1";
    }
    let width = parts[0].trim().parse::<f64>().unwrap_or(1.0).max(1.0);
    let height = parts[1].trim().parse::<f64>().unwrap_or(1.0).max(1.0);
    let ratio = width / height;
    let candidates = [
        ("1:1", 1.0),
        ("16:9", 16.0 / 9.0),
        ("9:16", 9.0 / 16.0),
        ("4:3", 4.0 / 3.0),
        ("3:4", 3.0 / 4.0),
        ("3:2", 3.0 / 2.0),
        ("2:3", 2.0 / 3.0),
        ("21:9", 21.0 / 9.0),
    ];
    candidates
        .iter()
        .min_by(|left, right| {
            let left_delta = (ratio - left.1).abs();
            let right_delta = (ratio - right.1).abs();
            left_delta
                .partial_cmp(&right_delta)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|item| item.0)
        .unwrap_or("1:1")
}

async fn build_minimax_subject_reference(
    client: &reqwest::Client,
    references: &[ReferenceImage],
) -> Result<Vec<Value>, String> {
    let reference = references
        .first()
        .ok_or_else(|| "MiniMax 图生图需要至少一张参考图。".to_string())?;
    let image_file = minimax_reference_image_file(client, reference).await?;
    Ok(vec![serde_json::json!({
        "type": "character",
        "image_file": image_file
    })])
}

async fn minimax_reference_image_file(
    client: &reqwest::Client,
    reference: &ReferenceImage,
) -> Result<String, String> {
    if let Some(url) = reference
        .data_url
        .as_deref()
        .or(reference.preview_url.as_deref())
        .filter(|url| url.starts_with("data:image/") || url.starts_with("http://") || url.starts_with("https://"))
    {
        if url.starts_with("http://") || url.starts_with("https://") {
            return Ok(url.to_string());
        }
        let (bytes, extension) = decode_data_url_image(url)?;
        return Ok(format!(
            "data:{};base64,{}",
            mime_from_extension(&extension),
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ));
    }

    if let Some(local_path) = reference.local_path.as_deref().filter(|value| !value.trim().is_empty()) {
        let path = PathBuf::from(local_path);
        if path.is_file() && is_supported_reference_image_path(&path) {
            return image_path_to_data_url(&path, "MiniMax subject reference");
        }
    }

    if let Some(remote) = reference
        .preview_url
        .as_deref()
        .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
    {
        let (bytes, extension) = download_remote_image(client, remote).await?;
        return Ok(format!(
            "data:{};base64,{}",
            mime_from_extension(&extension),
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ));
    }

    Err("MiniMax 图生图参考图缺少可提交的 data URL、本地路径或远程 URL。".to_string())
}

fn minimax_raw_has_error(raw: &Value) -> bool {
    raw.pointer("/base_resp/status_code")
        .and_then(|value| value.as_i64())
        .map(|status_code| status_code != 0)
        .unwrap_or(false)
}

fn minimax_error_category(status_code: u16, raw: &Value) -> &'static str {
    let api_code = raw
        .pointer("/base_resp/status_code")
        .and_then(|value| value.as_i64())
        .unwrap_or_default();
    let message = raw
        .pointer("/base_resp/status_msg")
        .or_else(|| raw.pointer("/base_resp/message"))
        .or_else(|| raw.get("message"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if status_code == 401 || message.contains("unauthorized") || message.contains("api key") {
        return "auth";
    }
    if status_code == 403 || message.contains("forbidden") || message.contains("permission") {
        return "permission";
    }
    if status_code == 404 || message.contains("not found") || message.contains("model") {
        return "model_or_endpoint";
    }
    if status_code == 429 || message.contains("rate") || message.contains("quota") || message.contains("limit") {
        return "quota_or_rate_limit";
    }
    if status_code == 400 || status_code == 422 || message.contains("invalid") || message.contains("param") {
        return "parameter";
    }
    if status_code >= 500 {
        return "provider_server";
    }
    if api_code != 0 {
        return "provider_error";
    }
    "no_image"
}

fn minimax_error_suggestion(category: &str) -> &'static str {
    match category {
        "auth" => "检查 MiniMax API Key 是否保存到当前配置实例，且没有误填中转站 Key。",
        "permission" => "检查 MiniMax 账号是否开通图片生成模型权限，或当前 Key 是否允许调用该 endpoint。",
        "model_or_endpoint" => "检查模型 ID 是否为 image-01 / image-01-live，Base URL 和 /v1/image_generation 路径是否匹配。",
        "quota_or_rate_limit" => "检查账号额度、频率限制或稍后重试；避免连续真实试生图消耗额度。",
        "parameter" => "回到默认 1:1、数量 1、image-01 后再试，逐项恢复尺寸、数量和高级参数。",
        "provider_server" => "MiniMax 服务端或网关异常；保留 raw 和请求摘要，稍后重试或到平台后台对照。",
        "provider_error" => "MiniMax 返回业务错误；复制诊断报告和 raw 与平台后台对照。",
        "response_parse" => "接口返回不是 JSON；检查 Base URL、接口路径或网关是否返回了网页/错误页。",
        _ => "没有提取到有效图片 URL；检查 response_format、模型权限和 raw 响应里的图片字段。",
    }
}

fn format_minimax_error(status_code: u16, raw: &Value) -> String {
    let api_code = raw
        .pointer("/base_resp/status_code")
        .and_then(|value| value.as_i64());
    let api_message = raw
        .pointer("/base_resp/status_msg")
        .or_else(|| raw.pointer("/base_resp/message"))
        .or_else(|| raw.get("message"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty());
    match (api_code, api_message) {
        (Some(code), Some(message)) => format!("MiniMax 返回错误 {code}：{message}"),
        (Some(code), None) => format!("MiniMax 返回错误 {code}。"),
        (None, Some(message)) => format!("MiniMax 请求失败：HTTP {status_code}，{message}"),
        (None, None) => format!("MiniMax 请求失败：HTTP {status_code}，没有返回有效图片。"),
    }
}

fn collect_images_recursive(value: &Value, urls: &mut Vec<String>, default_base64_mime: &str) {
    match value {
        Value::Object(map) => {
            for key in ["url", "image_url"] {
                if let Some(url) = map.get(key).and_then(|value| value.as_str()) {
                    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("data:image/") {
                        urls.push(url.to_string());
                    }
                }
            }
            for key in ["b64_json", "image_base64", "base64", "data", "result", "image"] {
                if let Some(b64) = map.get(key).and_then(|value| value.as_str()) {
                    if is_probable_base64_image(b64) {
                        urls.push(format!("data:{default_base64_mime};base64,{b64}"));
                    }
                }
            }
            for child in map.values() {
                collect_images_recursive(child, urls, default_base64_mime);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_images_recursive(item, urls, default_base64_mime);
            }
        }
        Value::String(text) => {
            if text.starts_with("http://") || text.starts_with("https://") || text.starts_with("data:image/") {
                urls.push(text.to_string());
            }
        }
        _ => {}
    }
}

fn is_probable_base64_image(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.len() <= 128 || trimmed.starts_with("http") || trimmed.starts_with("data:") {
        return false;
    }
    let sample: String = trimmed
        .chars()
        .take(160)
        .filter(|ch| !ch.is_whitespace())
        .collect();
    if sample.len() <= 128 {
        return false;
    }
    sample
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '/' | '=' | '-' | '_'))
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
            diagnose_comfyui_connection,
            generate_comfyui_image,
            polish_prompt_with_provider,
            load_generation_history,
            load_library_data,
            save_library_data,
            save_generation_record,
            recheck_background_generation,
            delete_generation_record,
            import_library_images_from_files,
            import_library_images_from_folder,
            reference_images_from_paths,
            load_inspirations,
            load_inspiration_sources,
            load_inspiration_assets,
            save_inspiration_source,
            delete_inspiration_source,
            import_inspiration_asset,
            save_inspiration_asset,
            delete_inspiration_asset,
            reveal_generation_file,
            get_app_paths,
            reveal_app_data_dir,
            reveal_library_dir,
            reveal_inspiration_dir,
            get_storage_settings,
            save_storage_settings,
            choose_library_dir,
            choose_inspiration_dir,
            open_external_url,
            export_settings_backup,
            save_text_file_with_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running VisionHub Studio");
}

fn main() {
    run();
}

