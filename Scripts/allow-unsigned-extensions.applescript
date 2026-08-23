tell application "Safari" to activate

tell application "System Events" to tell process "Safari"
	click menu item "Settings…" of menu 1 of menu bar item "Safari" of menu bar 1
	repeat 100 times
		if exists button "Developer" of toolbar 1 of window 1 then exit repeat
		delay 0.1
	end repeat
	click button "Developer" of toolbar 1 of window 1
	repeat with element in entire contents of window 1
		try
			if name of element is "Allow unsigned extensions" and value of element is 0 then click element
		end try
	end repeat
	click button 1 of window 1
end tell
