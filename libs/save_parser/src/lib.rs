mod core;
mod types;
mod utils;

use wasm_bindgen::prelude::*;

use crate::utils::set_panic_hook;
use gloo_utils::format::JsValueSerdeExt;
use js_sys::{ArrayBuffer, Uint8Array};
use uesave::Save;
use web_sys::console;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[wasm_bindgen]
extern "C" {}

fn array_buffer_to_vec(raw_save: &ArrayBuffer) -> Vec<u8> {
    Uint8Array::new_with_byte_offset_and_length(raw_save, 0, raw_save.byte_length()).to_vec()
}

#[wasm_bindgen]
pub fn inspect_save(raw_save: ArrayBuffer) -> Result<JsValue, String> {
    set_panic_hook();
    console::log_2(&"save_parser ".into(), &String::from(VERSION).into());

    let raw_save_content = array_buffer_to_vec(&raw_save);
    let mut inspection = core::inspect_save_bytes(&raw_save_content)?;

    if matches!(
        inspection.compatibility,
        core::CompatibilityLevel::NewerUntested
    ) && core::round_trip_save_bytes(&raw_save_content).is_ok()
    {
        inspection.export_allowed = true;
    }

    JsValue::from_serde(&inspection).map_err(|error| error.to_string())
}

#[wasm_bindgen]
pub fn decode_save(raw_save: ArrayBuffer) -> Result<JsValue, String> {
    set_panic_hook();
    console::log_2(&"save_parser ".into(), &String::from(VERSION).into());

    let raw_save_content = array_buffer_to_vec(&raw_save);
    let inner_save = core::decode_save_bytes(&raw_save_content)?;

    JsValue::from_serde(&inner_save).map_err(|error| error.to_string())
}

#[wasm_bindgen]
pub fn encode_save(raw_save: ArrayBuffer, new_inner_save: JsValue) -> Result<Vec<u8>, String> {
    set_panic_hook();
    console::log_2(&"save_parser ".into(), &String::from(VERSION).into());

    let raw_save_content = array_buffer_to_vec(&raw_save);
    let inner_save: Save = new_inner_save
        .into_serde()
        .map_err(|error| error.to_string())?;
    let encoded_save = core::encode_save_bytes(&raw_save_content, &inner_save)?;

    core::decode_save_bytes(&encoded_save)
        .map_err(|error| format!("Encoded save validation failed: {error}"))?;

    Ok(encoded_save)
}
