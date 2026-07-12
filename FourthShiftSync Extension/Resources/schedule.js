(() => {
  const pageSize = 100

  function formatAPIDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  function syncRange(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    return { start: formatAPIDate(start), end: formatAPIDate(end) }
  }

  async function fetchShifts(fetcher = fetch, now = new Date()) {
    const range = syncRange(now)
    const shifts = []
    let skip = 0

    while (true) {
      const url = new URL("/api/myschedules/schedule", location.origin)
      url.searchParams.set("$orderby", "StartDateTime asc")
      url.searchParams.set("$top", String(pageSize))
      url.searchParams.set("$skip", String(skip))
      url.searchParams.set("fromDate", range.start)
      url.searchParams.set("toDate", range.end)

      const response = await fetcher(url, {
        credentials: "include",
        headers: { Accept: "application/vnd.siren+json" }
      })

      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Your Fourth login has expired. Sign in and try again." : `Fourth returned ${response.status}.`)

      const page = await response.json()
      const entities = page.entities ?? []
      shifts.push(...entities.map(entity => entity.properties).filter(properties => properties.scheduleItemType === "Shift"))
      skip += entities.length

      if (entities.length < pageSize || skip >= page.properties.totalRows) break
    }

    return {
      shifts,
      syncStart: range.start.replaceAll("/", "-"),
      syncEnd: range.end.replaceAll("/", "-")
    }
  }

  globalThis.FourthSchedule = { fetchShifts, formatAPIDate, syncRange }
})()
