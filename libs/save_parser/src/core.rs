use std::cmp::min;
use std::io::{Cursor, Read, Write};

use byteorder::{LittleEndian, WriteBytesExt};
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use serde::Serialize;
use uesave::{ByteArray, PropertyInner, PropertyType, Save, ValueArray, ValueVec};

use crate::types;

pub const MAGIC_HEADER: [u8; 4] = [0xc1, 0x83, 0x2a, 0x9e];
pub const HEADER_SIZE: usize = 48;
pub const CHUNK_SIZE: usize = 0x20000;
pub const CHUNK_SIZE_IN_BYTES: [u8; 4] = [0x00, 0x00, 0x02, 0x00];
pub const NULL_HEADER: [u8; 4] = [0x00, 0x00, 0x00, 0x00];
pub const TESTED_SAVE_VERSIONS: &[i32] = &[201, 208];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CompatibilityLevel {
    Tested,
    NewerUntested,
    OlderUntested,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInspection {
    pub outer_version: i32,
    pub compatibility: CompatibilityLevel,
    pub export_allowed: bool,
    pub warning: Option<String>,
    pub compressed_len: usize,
    pub inner_len: usize,
    pub chunk_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RoundTripReport {
    pub original: SaveInspection,
    pub encoded: SaveInspection,
}

pub fn compatibility_for_version(version: i32) -> CompatibilityLevel {
    let min_tested = TESTED_SAVE_VERSIONS
        .iter()
        .min()
        .copied()
        .unwrap_or(version);
    let max_tested = TESTED_SAVE_VERSIONS
        .iter()
        .max()
        .copied()
        .unwrap_or(version);

    if TESTED_SAVE_VERSIONS.contains(&version) {
        CompatibilityLevel::Tested
    } else if version > max_tested {
        CompatibilityLevel::NewerUntested
    } else if version < min_tested {
        CompatibilityLevel::OlderUntested
    } else {
        CompatibilityLevel::OlderUntested
    }
}

pub fn find_zlib_offsets(bytes: &[u8]) -> Vec<usize> {
    let mut offsets = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        if let Some(offset) = bytes[index..]
            .windows(MAGIC_HEADER.len())
            .position(|window| window == MAGIC_HEADER)
        {
            let absolute_offset = index + offset;
            let zlib_start = absolute_offset + HEADER_SIZE;

            if zlib_start >= bytes.len() {
                break;
            }

            let end = min(zlib_start + 33 * 1024, bytes.len());
            match ZlibDecoder::new(&bytes[zlib_start..end]).read_exact(&mut [0u8]) {
                Ok(_) => {
                    offsets.push(absolute_offset);
                    index = zlib_start;
                }
                Err(_) => {
                    index = zlib_start;
                }
            }
        } else {
            break;
        }
    }

    offsets
}

pub fn decompress_save_data(compressed_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let offsets = find_zlib_offsets(compressed_bytes);
    if offsets.is_empty() {
        return Err("No zlib chunks found in compressedSaveData".to_string());
    }

    let mut decompressed = Vec::new();

    for index in 0..offsets.len() {
        let chunk_start = offsets[index] + HEADER_SIZE;
        let chunk_end = if index < offsets.len() - 1 {
            offsets[index + 1]
        } else {
            compressed_bytes.len()
        };

        if chunk_start >= chunk_end || chunk_end > compressed_bytes.len() {
            return Err(format!("Invalid zlib chunk bounds at index {index}"));
        }

        let mut decoder = ZlibDecoder::new(&compressed_bytes[chunk_start..chunk_end]);
        let mut bytes = Vec::new();
        decoder
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Unable to decompress zlib chunk {index}: {error}"))?;
        decompressed.extend(bytes);
    }

    Ok(decompressed)
}

pub fn compress_save(save: &[u8]) -> Result<Vec<u8>, String> {
    let mut compressed_save: Vec<u8> = Vec::new();
    let mut index: usize = 0;

    while index < save.len() {
        let end = min(index + CHUNK_SIZE, save.len());
        let chunk = &save[index..end];
        let chunk_size = end - index;
        let mut chunk_size_in_bytes: Vec<u8> = vec![];
        chunk_size_in_bytes
            .write_u32::<LittleEndian>(chunk_size as u32)
            .map_err(|error| format!("Unable to encode chunk size: {error}"))?;

        let mut encoder = ZlibEncoder::new(vec![], Compression::default());
        encoder
            .write_all(chunk)
            .map_err(|error| format!("Unable to compress chunk: {error}"))?;
        let compressed_chunk = encoder
            .finish()
            .map_err(|error| format!("Unable to finalize compressed chunk: {error}"))?;
        let mut compressed_chunk_size: Vec<u8> = vec![];
        compressed_chunk_size
            .write_u32::<LittleEndian>(compressed_chunk.len() as u32)
            .map_err(|error| format!("Unable to encode compressed chunk size: {error}"))?;

        compressed_save.extend(MAGIC_HEADER);
        compressed_save.extend(NULL_HEADER);
        compressed_save.extend(CHUNK_SIZE_IN_BYTES);
        compressed_save.extend(NULL_HEADER);

        compressed_save.extend(compressed_chunk_size.clone());
        compressed_save.extend(NULL_HEADER);
        compressed_save.extend(chunk_size_in_bytes.clone());
        compressed_save.extend(NULL_HEADER);

        compressed_save.extend(compressed_chunk_size);
        compressed_save.extend(NULL_HEADER);
        compressed_save.extend(chunk_size_in_bytes);
        compressed_save.extend(NULL_HEADER);

        compressed_save.extend(compressed_chunk);

        index = end;
    }

    Ok(compressed_save)
}

pub fn read_outer_save(raw_save: &[u8]) -> Result<Save, String> {
    let mut outer_save_buffer = Cursor::new(raw_save);
    Save::read(&mut outer_save_buffer).map_err(|error| error.to_string())
}

pub fn read_outer_version(outer_save: &Save) -> Result<i32, String> {
    let has_version = (&outer_save.root.properties)
        .into_iter()
        .any(|(key, _)| key.1 == "Version");
    if !has_version {
        return Err("Missing Version property".to_string());
    }

    match &outer_save.root.properties["Version"].inner {
        &PropertyInner::Int(save_version) => Ok(save_version),
        _ => Err("Invalid save version property type".to_string()),
    }
}

pub fn read_compressed_save_data(outer_save: &Save) -> Result<&Vec<u8>, String> {
    let has_compressed_save_data = (&outer_save.root.properties)
        .into_iter()
        .any(|(key, _)| key.1 == "compressedSaveData");
    if !has_compressed_save_data {
        return Err("Missing compressedSaveData property".to_string());
    }

    match &outer_save.root.properties["compressedSaveData"].inner {
        PropertyInner::Array {
            value: property_value,
            ..
        } => match property_value {
            ValueArray::Base(vec) => match vec {
                ValueVec::Byte(v) => match v {
                    ByteArray::Byte(b) => Ok(b),
                    _ => Err("Invalid compressedSaveData byte array".to_string()),
                },
                _ => Err("Invalid compressedSaveData byte array".to_string()),
            },
            _ => Err("Invalid compressedSaveData byte array".to_string()),
        },
        _ => Err("Invalid compressedSaveData property type".to_string()),
    }
}

pub fn replace_compressed_save_data(
    outer_save: &mut Save,
    compressed_inner_save: Vec<u8>,
) -> Result<(), String> {
    let has_compressed_save_data = (&outer_save.root.properties)
        .into_iter()
        .any(|(key, _)| key.1 == "compressedSaveData");
    if !has_compressed_save_data {
        return Err("Missing compressedSaveData property".to_string());
    }

    outer_save.root.properties["compressedSaveData"].inner = PropertyInner::Array {
        array_type: PropertyType::ByteProperty,
        value: ValueArray::Base(ValueVec::Byte(ByteArray::Byte(compressed_inner_save))),
    };

    Ok(())
}

pub fn read_inner_save_bytes(outer_save: &Save) -> Result<Vec<u8>, String> {
    let compressed_bytes = read_compressed_save_data(outer_save)?;
    let decompressed_bytes = decompress_save_data(compressed_bytes)?;

    if decompressed_bytes.len() < 4 {
        return Err("Decompressed inner save is shorter than its size prefix".to_string());
    }

    Ok(decompressed_bytes[4..].to_vec())
}

pub fn decode_inner_save(inner_save_bytes: &[u8]) -> Result<Save, String> {
    let mut inner_save_buffer = Cursor::new(inner_save_bytes);
    let save_types = types::get_types();
    Save::read_with_types(&mut inner_save_buffer, &save_types).map_err(|error| error.to_string())
}

pub fn decode_save_bytes(raw_save: &[u8]) -> Result<Save, String> {
    let outer_save = read_outer_save(raw_save)?;
    let inner_save_bytes = read_inner_save_bytes(&outer_save)?;
    decode_inner_save(&inner_save_bytes)
}

pub fn inspect_save_bytes(raw_save: &[u8]) -> Result<SaveInspection, String> {
    let outer_save = read_outer_save(raw_save)?;
    let outer_version = read_outer_version(&outer_save)?;
    let compressed_bytes = read_compressed_save_data(&outer_save)?;
    let inner_save_bytes = read_inner_save_bytes(&outer_save)?;
    let compatibility = compatibility_for_version(outer_version);
    let export_allowed = matches!(compatibility, CompatibilityLevel::Tested);
    let warning = match compatibility {
        CompatibilityLevel::Tested => None,
        CompatibilityLevel::NewerUntested => Some(
            "This save is from a newer Coral Island save version than this editor has tested. It decoded successfully, but compatibility is not guaranteed. Back up your original save before using the exported file."
                .to_string(),
        ),
        CompatibilityLevel::OlderUntested => Some(
            "This save is from an older Coral Island save version than this editor has tested. Export is disabled until this version is verified with a local fixture."
                .to_string(),
        ),
    };

    Ok(SaveInspection {
        outer_version,
        compatibility,
        export_allowed,
        warning,
        compressed_len: compressed_bytes.len(),
        inner_len: inner_save_bytes.len(),
        chunk_count: find_zlib_offsets(compressed_bytes).len(),
    })
}

pub fn encode_save_bytes(raw_save: &[u8], new_inner_save: &Save) -> Result<Vec<u8>, String> {
    let mut inner_save_buffer = Cursor::new(vec![]);
    new_inner_save
        .write(&mut inner_save_buffer)
        .map_err(|error| format!("Failed to encode inner save: {error}"))?;
    let mut inner_save_bytes = inner_save_buffer.into_inner();

    if inner_save_bytes.len() < 4 {
        return Err("Encoded inner save is shorter than expected".to_string());
    }

    let inner_save_size_le: [u8; 4] = u32::to_le_bytes((inner_save_bytes.len() - 4) as u32);
    inner_save_bytes.splice(0..0, inner_save_size_le.iter().cloned());

    let compressed_inner_save = compress_save(&inner_save_bytes)?;
    let mut outer_save = read_outer_save(raw_save)?;
    replace_compressed_save_data(&mut outer_save, compressed_inner_save)?;

    let mut outer_save_output = Cursor::new(vec![]);
    outer_save
        .write(&mut outer_save_output)
        .map_err(|error| format!("Failed to encode outer save: {error}"))?;

    Ok(outer_save_output.into_inner())
}

pub fn round_trip_save_bytes(raw_save: &[u8]) -> Result<RoundTripReport, String> {
    let inner_save = decode_save_bytes(raw_save)?;
    let encoded_save = encode_save_bytes(raw_save, &inner_save)?;
    let _encoded_inner_save = decode_save_bytes(&encoded_save)?;
    let original = inspect_save_bytes(raw_save)?;
    let mut encoded = inspect_save_bytes(&encoded_save)?;

    if matches!(original.compatibility, CompatibilityLevel::NewerUntested) {
        encoded.export_allowed = true;
    }

    if original.outer_version != encoded.outer_version {
        return Err(format!(
            "Outer save version changed during round trip: {} -> {}",
            original.outer_version, encoded.outer_version
        ));
    }

    Ok(RoundTripReport { original, encoded })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compression_round_trip_preserves_bytes() {
        let bytes = (0..CHUNK_SIZE + 17)
            .map(|index| (index % 251) as u8)
            .collect::<Vec<_>>();

        let compressed = compress_save(&bytes).expect("compression should succeed");
        let decompressed = decompress_save_data(&compressed).expect("decompression should succeed");

        assert_eq!(decompressed, bytes);
        assert_eq!(find_zlib_offsets(&compressed).len(), 2);
    }

    #[test]
    fn compatibility_classifies_versions() {
        assert_eq!(compatibility_for_version(201), CompatibilityLevel::Tested);
        assert_eq!(compatibility_for_version(208), CompatibilityLevel::Tested);
        assert_eq!(
            compatibility_for_version(209),
            CompatibilityLevel::NewerUntested
        );
        assert_eq!(
            compatibility_for_version(200),
            CompatibilityLevel::OlderUntested
        );
    }
}
