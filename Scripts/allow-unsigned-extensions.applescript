on checkboxNamed(settingsWindow, label)
	tell application "System Events"
		repeat with element in (entire contents of settingsWindow)
			try
				if role of element is "AXCheckBox" and name of element is label then return element
			end try
		end repeat
	end tell
	return missing value
end checkboxNamed

on describePane(settingsWindow)
	set names to {}
	set total to 0
	tell application "System Events"
		repeat with element in (entire contents of settingsWindow)
			set total to total + 1
			try
				if role of element is "AXCheckBox" then set end of names to name of element
			end try
		end repeat
	end tell
	set AppleScript's text item delimiters to ", "
	return (total as text) & " elements, checkboxes: " & (names as text)
end describePane

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
		set box to my checkboxNamed(window 1, "Allow unsigned extensions")
		if box is not missing value then exit repeat
		delay 0.1
	end repeat
	if box is missing value then error "No Allow unsigned extensions checkbox. Developer pane has " & my describePane(window 1)

	if value of box is 0 then click box
	delay 0.3
	if value of box is 0 then error "Allow unsigned extensions would not stay ticked."
	click button 1 of window 1
end tell
