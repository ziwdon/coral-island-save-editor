# Local Save Fixtures

This directory is for local copies of Coral Island .sav files used by parser tests and diagnostics.

Do not edit files in the Steam save directory; copy saves here and work from copies.

Typical Proton/Steam source path:

```text
/home/ziwdon/.steam/debian-installation/steamapps/compatdata/1158160/pfx/drive_c/users/steamuser/AppData/Local/ProjectCoral/Saved/SaveGames/
```

Expected local fixture names:

```text
fixtures/saves/v201.sav
fixtures/saves/v208.sav
```

Suggested copy commands:

```bash
cp /home/ziwdon/.steam/debian-installation/steamapps/compatdata/1158160/pfx/drive_c/users/steamuser/AppData/Local/ProjectCoral/Saved/SaveGames/OldVersion/DailySave_0_v201.sav fixtures/saves/v201.sav
cp /home/ziwdon/.steam/debian-installation/steamapps/compatdata/1158160/pfx/drive_c/users/steamuser/AppData/Local/ProjectCoral/Saved/SaveGames/World_0/ManualSave0.sav fixtures/saves/v208.sav
```

.sav files and manifest.local.json are gitignored.
