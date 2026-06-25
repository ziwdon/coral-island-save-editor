use std::fs;
use std::path::PathBuf;

use save_parser::core::{
    decode_save_bytes, inspect_save_bytes, round_trip_save_bytes, CompatibilityLevel,
};
use uesave::Save;

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

    Some(fs::read(&path).unwrap_or_else(|error| {
        panic!("failed to read fixture {}: {error}", path.display())
    }))
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
    }
}
