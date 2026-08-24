on findCheckbox(element, label)
	tell application "System Events"
		try
			if role of element is "AXCheckBox" and name of element is label then return element
		end try
		try
			repeat with child in UI elements of element
				set found to my findCheckbox(child, label)
				if found is not missing value then return found
			end repeat
		end try
	end tell
	return missing value
end findCheckbox

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
		set box to my findCheckbox(window 1, "Allow unsigned extensions")
		if box is not missing value then exit repeat
		delay 0.1
	end repeat
	if box is missing value then error "No Allow unsigned extensions checkbox on the Developer pane."

	if value of box is 0 then click box
	delay 0.3
	if value of box is 0 then error "Allow unsigned extensions would not stay ticked."
	click button 1 of window 1
end tell
