browser.runtime.onMessage.addListener(message => {
  if (message.action === "syncCalendar") return browser.runtime.sendNativeMessage(message)
})
