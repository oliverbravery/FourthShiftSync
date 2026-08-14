async function postToSheet({ endpoint, ...payload }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })

  if (!response.ok) throw new Error(`The sheet script returned ${response.status}.`)
  return response.json()
}

browser.runtime.onMessage.addListener(message => {
  if (message.action === "syncCalendar") return browser.runtime.sendNativeMessage(message)
  if (message.action === "syncSheet" || message.action === "provisionSheet") return postToSheet(message)
})
