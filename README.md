# Fourth Shift Sync

A Safari extension that adds a Sync button to Fourth's My Schedule page. It copies your shifts into Apple Calendar, and into a Google Sheet if you set that up.

Needs macOS 14, Safari 17 and Xcode 26 or later.

## Install

Build it:

```sh
xcodebuild -project FourthShiftSync.xcodeproj -scheme FourthShiftSync -configuration Release -derivedDataPath DerivedData build
```

Open it once so Safari picks up the extension:

```sh
open DerivedData/Build/Products/Release/FourthShiftSync.app
```

The build is signed locally, so Safari needs **Develop > Allow Unsigned Extensions**. That menu appears once you tick **Show features for web developers** in Settings > Advanced, and the setting resets every time Safari quits. Then enable Fourth Shift Sync in Settings > Extensions and allow `api.fourth.com`.

## Use

Open My Schedule and select **Sync**. Grant Calendar access on the first run. The panel lists what was added, changed and removed, and **⚙** opens settings.

Events go in a calendar named `Fourth` unless you set another name. Only events the extension created are ever changed or deleted.

## Sheet sync

Optional, and skipped until you set it up. The sheet itself is made for you, so there is nothing to lay out by hand.

1. Go to [script.google.com](https://script.google.com), start a new project and paste in [AppsScript/Code.js](AppsScript/Code.js).
2. **Deploy > New deployment > Web app**, executing as you, access set to **Anyone**. Authorise it when asked.
3. Copy the `/exec` URL into **⚙** on My Schedule.

A spreadsheet named **Fourth Shifts** appears in your Drive, with the shift table, running totals and an hourly rate cell to fill in. The panel links to it. Nothing else in your Drive is touched, and the URL is the only secret, so keep it to yourself.

Each sync covers today to a year ahead. It adds missing shifts in date order, copying the row above so your formulas carry down, fixes times and breaks that changed, and deletes rows Fourth no longer has. Only `Date`, `Start Time`, `End Time` and `Break (Mins)` are written, so a column like `Actual Pay` is left alone, and rows dated before today are never touched.

## Test

```sh
node --test Tests/*.test.js
```
