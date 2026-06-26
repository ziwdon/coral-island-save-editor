use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

use save_parser::core::{
    decode_save_bytes, encode_save_bytes, inspect_save_bytes, read_outer_save,
    round_trip_save_bytes, CompatibilityLevel,
};
use serde_json::Value;
use uesave::{PropertyInner, Save};

const PLAYER_GOLD_JSON_PATH: &str =
    "root.properties.SaveData_0.Struct.value.Struct.players_0.Array.value.Values[0].playerCurrentGold_0.Int";

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("workspace root should resolve")
}

fn fixture_path(name: &str) -> PathBuf {
    workspace_root().join("fixtures/saves").join(name)
}

fn read_optional_fixture(name: &str) -> Option<Vec<u8>> {
    let path = fixture_path(name);

    if !path.exists() {
        println!("SKIP {name}: fixture not found at {}", path.display());
        return None;
    }

    Some(
        fs::read(&path)
            .unwrap_or_else(|error| panic!("failed to read fixture {}: {error}", path.display())),
    )
}

fn assert_save_data_exists(save: &Save) {
    let keys = (&save.root.properties)
        .into_iter()
        .map(|(key, _property)| key.1.as_str())
        .collect::<Vec<_>>();

    assert!(
        keys.contains(&"saveData"),
        "saveData property should exist; found keys: {:?}",
        keys
    );
}

fn with_outer_version(raw_save: &[u8], version: i32) -> Vec<u8> {
    let mut outer_save = read_outer_save(raw_save).expect("outer save should parse");
    let property = outer_save
        .root
        .properties
        .0
        .iter_mut()
        .find_map(|(key, property)| (key.1 == "Version").then_some(property))
        .expect("Version property should exist");
    property.inner = PropertyInner::Int(version);

    let mut output = Cursor::new(Vec::new());
    outer_save
        .write(&mut output)
        .expect("outer save should encode");
    output.into_inner()
}

fn split_json_segment(segment: &str) -> Option<(&str, Option<usize>)> {
    let Some(start_index) = segment.find('[') else {
        return Some((segment, None));
    };

    if !segment.ends_with(']') {
        return None;
    }

    let key = &segment[..start_index];
    let array_index = segment[start_index + 1..segment.len() - 1].parse().ok()?;
    Some((key, Some(array_index)))
}

fn get_json_path<'a>(mut value: &'a Value, path: &str) -> Option<&'a Value> {
    for segment in path.split('.') {
        let (key, array_index) = split_json_segment(segment)?;
        value = value.get(key)?;

        if let Some(array_index) = array_index {
            value = value.get(array_index)?;
        }
    }

    Some(value)
}

fn get_json_path_mut<'a>(mut value: &'a mut Value, path: &str) -> Option<&'a mut Value> {
    for segment in path.split('.') {
        let (key, array_index) = split_json_segment(segment)?;
        value = value.get_mut(key)?;

        if let Some(array_index) = array_index {
            value = value.get_mut(array_index)?;
        }
    }

    Some(value)
}

#[test]
fn local_fixtures_are_optional() {
    let mut missing = false;

    for name in ["v201.sav", "v208.sav", "v220.sav"] {
        if read_optional_fixture(name).is_none() {
            missing = true;
        }
    }

    if missing {
        println!("SKIP local fixture decode tests require private .sav files");
    }
}

#[test]
fn decodes_v201_fixture_when_present() {
    let Some(raw_save) = read_optional_fixture("v201.sav") else {
        return;
    };

    let inspection = inspect_save_bytes(&raw_save).expect("v201 fixture should inspect");
    assert_eq!(inspection.outer_version, 201);
    assert_eq!(inspection.compatibility, CompatibilityLevel::Tested);

    let inner_save = decode_save_bytes(&raw_save).expect("v201 fixture should decode");
    assert_save_data_exists(&inner_save);
}

#[test]
fn decodes_v208_fixture_when_present() {
    let Some(raw_save) = read_optional_fixture("v208.sav") else {
        return;
    };

    let inspection = inspect_save_bytes(&raw_save).expect("v208 fixture should inspect");
    assert_eq!(inspection.outer_version, 208);
    assert_eq!(inspection.compatibility, CompatibilityLevel::Tested);

    let inner_save = decode_save_bytes(&raw_save).expect("v208 fixture should decode");
    assert_save_data_exists(&inner_save);
}

#[test]
fn decodes_v220_fixture_when_present() {
    let Some(raw_save) = read_optional_fixture("v220.sav") else {
        return;
    };

    let inspection = inspect_save_bytes(&raw_save).expect("v220 fixture should inspect");
    assert_eq!(inspection.outer_version, 220);
    assert_eq!(inspection.compatibility, CompatibilityLevel::Tested);

    let inner_save = decode_save_bytes(&raw_save).expect("v220 fixture should decode");
    assert_save_data_exists(&inner_save);
}

#[test]
fn round_trips_known_fixtures_without_edits_when_present() {
    for name in ["v201.sav", "v208.sav", "v220.sav"] {
        let Some(raw_save) = read_optional_fixture(name) else {
            continue;
        };

        let report = round_trip_save_bytes(&raw_save)
            .unwrap_or_else(|error| panic!("{} should round trip without edits: {}", name, error));
        let inner_save = decode_save_bytes(&raw_save)
            .unwrap_or_else(|error| panic!("{} should decode before round trip: {}", name, error));
        let encoded_save = encode_save_bytes(&raw_save, &inner_save)
            .unwrap_or_else(|error| panic!("{} should encode without edits: {}", name, error));
        let encoded_inner_save = decode_save_bytes(&encoded_save)
            .unwrap_or_else(|error| panic!("{} should decode after round trip: {}", name, error));

        assert_eq!(report.original.outer_version, report.encoded.outer_version);
        assert!(report.original.inner_len > 0, "{} original inner_len", name);
        assert!(report.encoded.inner_len > 0, "{} encoded inner_len", name);
        assert!(
            report.original.chunk_count > 0,
            "{} original chunk_count",
            name
        );
        assert!(
            report.encoded.chunk_count > 0,
            "{} encoded chunk_count",
            name
        );
        assert_save_data_exists(&encoded_inner_save);
    }
}

#[test]
fn inspect_allows_newer_readable_fixture_after_round_trip_validation() {
    let Some(raw_save) = read_optional_fixture("v220.sav") else {
        return;
    };
    let newer_save = with_outer_version(&raw_save, 221);

    let inspection = inspect_save_bytes(&newer_save)
        .expect("newer fixture should inspect after only outer version changes");

    assert_eq!(inspection.outer_version, 221);
    assert_eq!(inspection.compatibility, CompatibilityLevel::NewerUntested);
    assert!(
        inspection.export_allowed,
        "newer readable saves that round-trip should be exportable with a warning"
    );
    assert!(
        inspection.warning.is_some(),
        "newer untested saves should still warn"
    );
}

#[test]
fn edits_player_gold_fixture_and_round_trips_when_present() {
    let mut edited_any_fixture = false;

    for name in ["v201.sav", "v208.sav", "v220.sav"] {
        let Some(raw_save) = read_optional_fixture(name) else {
            continue;
        };

        let inner_save = decode_save_bytes(&raw_save).unwrap_or_else(|error| {
            panic!("{} should decode before primitive edit: {}", name, error)
        });
        let mut save_json =
            serde_json::to_value(&inner_save).expect("decoded save should serialize to JSON");

        let Some(gold_value) = get_json_path_mut(&mut save_json, PLAYER_GOLD_JSON_PATH) else {
            println!("SKIP {name}: player gold path not found");
            continue;
        };
        let Some(original_gold) = gold_value.as_i64() else {
            println!("SKIP {name}: player gold path is not an integer");
            continue;
        };

        let edited_gold = original_gold + 37;
        *gold_value = Value::from(edited_gold);
        edited_any_fixture = true;

        let edited_save: Save =
            serde_json::from_value(save_json).expect("edited save JSON should deserialize");
        let encoded_save = encode_save_bytes(&raw_save, &edited_save).unwrap_or_else(|error| {
            panic!("{} should encode after primitive edit: {}", name, error)
        });
        let encoded_inner_save = decode_save_bytes(&encoded_save).unwrap_or_else(|error| {
            panic!("{} should decode after primitive edit: {}", name, error)
        });
        let encoded_json =
            serde_json::to_value(&encoded_inner_save).expect("encoded save should serialize");
        let actual_gold = get_json_path(&encoded_json, PLAYER_GOLD_JSON_PATH)
            .and_then(Value::as_i64)
            .unwrap_or_else(|| panic!("{} encoded player gold path should remain readable", name));

        assert_eq!(
            actual_gold, edited_gold,
            "{name} player gold edit should survive"
        );
    }

    if !edited_any_fixture {
        println!("SKIP primitive edit round-trip test requires a fixture with player gold");
    }
}
