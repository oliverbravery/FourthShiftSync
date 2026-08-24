on elementNamed(settingsWindow, label)
	tell application "System Events"
		repeat with element in (entire contents of settingsWindow)
			try
				if name of element is label then return element
			end try
		end repeat
	end tell
	return missing value
end elementNamed

on describePane(settingsWindow)
	set descriptions to {}
	tell application "System Events"
		repeat with element in (entire contents of settingsWindow)
			set elementRole to "?"
			set elementName to "?"
			try
				set elementRole to role of element as text
			end try
			try
				set elementName to name of element as text
			end try
			set end of descriptions to elementRole & ":" & elementName
		end repeat
	end tell
	set AppleScript's text item delimiters to " | "
	return descriptions as text
end describePane

on isTicked(box)
	tell application "System Events"
		try
			return (value of box) as boolean
		end try
	end tell
	return false
end isTicked

tell application "Safari" to activate

tell application "System Events" to tell process "Safari"
	click menu item "Settings…" of menu 1 of menu bar item "Safari" of menu bar 1
	repeat 100 times
		if exists button "Developer" of toolbar 1 of window 1 then exit repeat
		delay 0.1
	end repeat
	click button "Developer" of toolbar 1 of window 1

	set box to missing value
	repeat 100 times
		set box to my elementNamed(window 1, "Allow unsigned extensions")
		if box is not missing value then exit repeat
		delay 0.1
	end repeat
	if box is missing value then error "No Allow unsigned extensions control. Developer pane holds " & my describePane(window 1)

	if not my isTicked(box) then click box
	delay 0.3
	if not my isTicked(box) then error "Allow unsigned extensions would not stay ticked."
	click button 1 of window 1
end tell
