# Local Save Fixtures

This directory is for manual local copies of Coral Island .sav files used by parser tests and diagnostics.

The browser app does not copy files into this directory. It reads the save file selected by the user and exports a downloaded copy.

For parser tests and diagnostics, do not edit files in the Steam save directory. Copy saves here manually and work from those copies.

Typical Windows source path:

```text
%LOCALAPPDATA%\ProjectCoral\Saved\SaveGames
```

Typical Proton source path:

```text
<steam-library>/steamapps/compatdata/1158160/pfx/drive_c/users/steamuser/AppData/Local/ProjectCoral/Saved/SaveGames
```

Expected local fixture names:

```text
fixtures/saves/v201.sav
fixtures/saves/v208.sav
fixtures/saves/v220.sav
```

Suggested copy commands:

```bash
cp "<save-directory>/<save-file>.sav" fixtures/saves/v201.sav
cp "<save-directory>/<save-file>.sav" fixtures/saves/v208.sav
cp "<save-directory>/<save-file>.sav" fixtures/saves/v220.sav
```

.sav files and manifest.local.json are gitignored.
