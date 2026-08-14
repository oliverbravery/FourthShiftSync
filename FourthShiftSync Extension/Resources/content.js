(() => {
  const defaultCalendarName = "Fourth"
  const storageKeys = ["calendarName", "endpoint", "spreadsheetUrl", "startupShown"]
  const root = document.createElement("aside")
  root.id = "fourth-shift-sync"
  root.innerHTML = `
    <section class="fourth-sync-results" hidden></section>
    <div class="fourth-sync-controls">
      <button type="button" class="fourth-sync-settings-button" aria-label="Settings">⚙</button>
      <button type="button" class="fourth-sync-button">Sync shifts</button>
    </div>
  `
  document.body.append(root)

  const button = root.querySelector(".fourth-sync-button")
  const settingsButton = root.querySelector(".fourth-sync-settings-button")
  const results = root.querySelector(".fourth-sync-results")

  function escapeHTML(value) {
    const element = document.createElement("span")
    element.textContent = value
    return element.innerHTML
  }

  function changeSection(title, changes, prefix) {
    if (!changes.length) return ""
    return `
      <details open>
        <summary>${title} (${changes.length})</summary>
        <ul>${changes.map(change => `
          <li><code>${prefix}</code> ${escapeHTML(change.summary)}${change.details.length ? `<ul>${change.details.map(detail => `<li><code>${escapeHTML(detail)}</code></li>`).join("")}</ul>` : ""}</li>
        `).join("")}</ul>
      </details>
    `
  }

  function sectionBody({ changes, message, error }) {
    if (error) return `<p class="fourth-sync-failure">${escapeHTML(error)}</p>`
    if (message) return `<p>${escapeHTML(message)}</p>`
    return `
      ${changeSection("Added", changes.added, "+")}
      ${changeSection("Changed", changes.updated, "~")}
      ${changeSection("Removed", changes.removed, "−")}
      <p>${changes.unchangedCount} unchanged</p>
    `
  }

  function targetSection(target) {
    return `<section><h3>${escapeHTML(target.title)}</h3>${sectionBody(target)}</section>`
  }

  function heading(targets, failed) {
    if (!targets.length) return "Fourth Shift Sync"
    return failed ? "Sync incomplete" : "Shifts synced"
  }

  async function render(targets) {
    const settings = await browser.storage.local.get(storageKeys)
    const failed = targets.some(target => target.error)

    results.className = `fourth-sync-results ${failed ? "fourth-sync-error" : "fourth-sync-success"}`
    results.innerHTML = `
      <header><strong>${heading(targets, failed)}</strong><button type="button" aria-label="Close results">×</button></header>
      ${targets.map(targetSection).join("")}
      <details class="fourth-sync-settings" ${settings.endpoint ? "" : "open"}>
        <summary>Settings</summary>
        <label>Calendar name<input type="text" name="calendarName" placeholder="${defaultCalendarName}"></label>
        <label>Sheet script URL<input type="url" name="endpoint" placeholder="https://script.google.com/macros/s/…/exec"></label>
        ${settings.spreadsheetUrl ? `<a href="${encodeURI(settings.spreadsheetUrl)}" target="_blank" rel="noreferrer">Open your shifts sheet</a>` : ""}
      </details>
    `
    results.hidden = false
    results.querySelector("header button").addEventListener("click", () => { results.hidden = true })

    for (const input of results.querySelectorAll(".fourth-sync-settings input")) {
      input.value = settings[input.name] ?? ""
      input.addEventListener("change", async () => {
        const value = input.value.trim()
        if (value === (settings[input.name] ?? "")) return

        await browser.storage.local.set({ [input.name]: value })
        if (input.name === "endpoint") await createSheet()
      })
    }
  }

  async function send(message) {
    const response = await browser.runtime.sendMessage(message)
    if (!response?.success) throw new Error(response?.error ?? "The request failed.")
    return response
  }

  async function syncTarget(title, message) {
    try {
      const { changes, spreadsheetUrl } = await send(message)
      if (spreadsheetUrl) await browser.storage.local.set({ spreadsheetUrl })
      return { title, changes }
    } catch (error) {
      return { title, error: error.message }
    }
  }

  async function createSheet() {
    const { endpoint } = await browser.storage.local.get(storageKeys)
    if (!endpoint) return

    try {
      const { spreadsheetUrl } = await send({ action: "provisionSheet", endpoint })
      await browser.storage.local.set({ spreadsheetUrl })
      await render([{ title: "Spreadsheet", message: "Your shifts sheet is ready. Select Sync shifts to fill it in." }])
    } catch (error) {
      await render([{ title: "Spreadsheet", error: error.message }])
    }
  }

  settingsButton.addEventListener("click", () => {
    if (results.hidden) render([])
    else results.hidden = true
  })

  button.addEventListener("click", async () => {
    button.disabled = true
    button.textContent = "Syncing…"

    try {
      const schedule = await FourthSchedule.fetchShifts()
      const { calendarName, endpoint } = await browser.storage.local.get(storageKeys)
      const targets = [await syncTarget("Apple Calendar", { action: "syncCalendar", calendarName: calendarName || defaultCalendarName, ...schedule })]

      if (endpoint) targets.push(await syncTarget("Spreadsheet", { action: "syncSheet", endpoint, ...schedule }))
      await render(targets)
    } catch (error) {
      await render([{ title: "Fourth", error: error.message }])
    } finally {
      button.disabled = false
      button.textContent = "Sync shifts"
    }
  })

  browser.storage.local.get(storageKeys).then(async settings => {
    if (settings.endpoint) return settings.spreadsheetUrl ? undefined : createSheet()
    if (settings.startupShown) return

    await browser.storage.local.set({ startupShown: true })
    await render([{ title: "Spreadsheet", message: "Paste your sheet script URL below and a shifts sheet is created for you. Apple Calendar works without it." }])
  })
})()
