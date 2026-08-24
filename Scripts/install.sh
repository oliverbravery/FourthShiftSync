#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/.."

extension_id=uk.co.oliverbravery.FourthShiftSync.Extension
built_app=DerivedData/Build/Products/Release/FourthShiftSync.app
installed_app=/Applications/FourthShiftSync.app
lsregister=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

extension_is_installed() {
	pluginkit -m -vvv -p com.apple.Safari.web-extension -i "$extension_id" | grep -qF "$installed_app"
}

xcodebuild -project FourthShiftSync.xcodeproj -scheme FourthShiftSync -configuration Release -derivedDataPath DerivedData -quiet build

osascript -e 'if application "Safari" is running then tell application "Safari" to quit'
for _ in {1..50}; do
	if ! pgrep -xq Safari; then break; fi
	sleep 0.2
done
if pgrep -xq Safari; then
	echo 'Safari will not quit. Allow your terminal to control Safari in System Settings > Privacy & Security > Automation.'
	exit 1
fi
pkill -x FourthShiftSync || :

stale=(${(f)"$("$lsregister" -dump | sed -n 's/^[[:space:]]*path:[[:space:]]*//p' | sed 's/ (0x[0-9a-f]*)$//' | grep -E '/Fourth ?Shift ?Sync[^/]*\.app$' | sort -u)"}) || :
for app in $stale; do "$lsregister" -u "$app"; done

rm -rf "$installed_app"
ditto "$built_app" "$installed_app"
"$lsregister" -f "$installed_app"
open "$installed_app"

for _ in {1..50}; do
	if extension_is_installed; then break; fi
	sleep 0.2
done
if ! extension_is_installed; then
	echo "Safari has not picked the extension up from $installed_app."
	exit 1
fi

open -a Safari
osascript Scripts/allow-unsigned-extensions.applescript ||
	echo 'Tick Allow unsigned extensions in Safari Settings > Developer, or grant your terminal Accessibility access in System Settings > Privacy & Security to have this done for you.'
