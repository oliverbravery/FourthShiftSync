(() => {
  const root = document.createElement("aside")
  root.id = "fourth-shift-sync"
  root.innerHTML = `
    <button type="button" class="fourth-sync-button">Sync Apple Calendar</button>
    <section class="fourth-sync-results" hidden></section>
  `
  document.body.append(root)

  const button = root.querySelector(".fourth-sync-button")
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

  function renderChanges(changes) {
    results.className = "fourth-sync-results fourth-sync-success"
    results.innerHTML = `
      <header><strong>Calendar synced</strong><button type="button" aria-label="Close results">×</button></header>
      ${changeSection("Added", changes.added, "+")}
      ${changeSection("Changed", changes.updated, "~")}
      ${changeSection("Removed", changes.removed, "−")}
      <p>${changes.unchangedCount} unchanged</p>
    `
    results.hidden = false
    results.querySelector("button").addEventListener("click", () => { results.hidden = true })
  }

  function renderError(error) {
    results.className = "fourth-sync-results fourth-sync-error"
    results.innerHTML = `<header><strong>Sync failed</strong><button type="button" aria-label="Close results">×</button></header><p>${escapeHTML(error)}</p>`
    results.hidden = false
    results.querySelector("button").addEventListener("click", () => { results.hidden = true })
  }

  button.addEventListener("click", async () => {
    button.disabled = true
    button.textContent = "Syncing…"

    try {
      const schedule = await FourthSchedule.fetchShifts()
      const response = await browser.runtime.sendMessage({ action: "syncCalendar", ...schedule })
      if (!response?.success) throw new Error(response?.error ?? "Calendar sync failed.")
      renderChanges(response.changes)
    } catch (error) {
      renderError(error.message)
    } finally {
      button.disabled = false
      button.textContent = "Sync Apple Calendar"
    }
  })
})()
