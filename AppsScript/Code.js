function doPost(event) {
  return ContentService.createTextOutput(JSON.stringify(FourthSheet.respond(event))).setMimeType(ContentService.MimeType.JSON)
}

(() => {
  const headings = { date: "Date", start: "Start Time", end: "End Time", break: "Break (Mins)" }
  const spreadsheetProperty = "SPREADSHEET_ID"

  function spreadsheet() {
    const properties = PropertiesService.getScriptProperties()
    const id = properties.getProperty(spreadsheetProperty)
    if (id) return SpreadsheetApp.openById(id)

    const lock = LockService.getScriptLock()
    lock.waitLock(60000)

    try {
      const waited = properties.getProperty(spreadsheetProperty)
      if (waited) return SpreadsheetApp.openById(waited)

      const created = createSpreadsheet()
      properties.setProperty(spreadsheetProperty, created.getId())
      return created
    } finally {
      lock.releaseLock()
    }
  }

  function createSpreadsheet() {
    const created = SpreadsheetApp.create("Fourth Shifts")
    const sheet = created.getSheets()[0].setName("Shifts")

    sheet.getRange("A1:B3").setValues([
      ["Hourly rate", 0],
      ["Total hours", "=SUM(E6:E)"],
      ["Total pay", "=SUM(F6:F)"]
    ])
    sheet.getRange("A5:G5").setValues([[headings.date, headings.start, headings.end, headings.break, "Total Hours", "Pay", "Actual Pay"]]).setFontWeight("bold")
    sheet.getRange("E6:F6").setValues([['=IF($A6="","",MOD($C6-$B6,1)*24-$D6/60)', '=IF($A6="","",$E6*$B$1)']])
    sheet.getRange("A6:A").setNumberFormat("dd/MM/yyyy")
    sheet.getRange("B6:C").setNumberFormat("HH:mm")
    sheet.getRange("E6:E").setNumberFormat("0.00")
    sheet.getRangeList(["B1", "F6:G"]).setNumberFormat("£#,##0.00")
    sheet.setFrozenRows(5)
    sheet.autoResizeColumns(1, 7)

    return created
  }

  function findLayout(sheet) {
    const rows = sheet.getDataRange().getValues()
    const headerIndex = rows.findIndex(cells => cells.includes(headings.date) && cells.includes(headings.start))
    if (headerIndex === -1) return null

    const cells = rows[headerIndex]
    const first = cells.findIndex(value => value !== "")
    let last = first
    while (last + 1 < cells.length && cells[last + 1] !== "") last += 1

    return {
      headerRow: headerIndex + 1,
      firstColumn: first + 1,
      lastColumn: last + 1,
      columns: Object.fromEntries(Object.entries(headings).map(([name, heading]) => [name, cells.indexOf(heading) + 1]))
    }
  }

  function readRows(sheet, layout, timeZone) {
    const height = sheet.getLastRow() - layout.headerRow
    if (height < 1) return []

    const width = layout.lastColumn - layout.firstColumn + 1
    const values = sheet.getRange(layout.headerRow + 1, layout.firstColumn, height, width).getValues()
    const rows = []

    for (const [index, cells] of values.entries()) {
      const cell = column => cells[column - layout.firstColumn]
      const date = cell(layout.columns.date)
      if (!(date instanceof Date)) break

      rows.push({
        row: layout.headerRow + 1 + index,
        day: Utilities.formatDate(date, timeZone, "yyyy-MM-dd"),
        start: Utilities.formatDate(cell(layout.columns.start), timeZone, "HH:mm"),
        end: Utilities.formatDate(cell(layout.columns.end), timeZone, "HH:mm"),
        breakMinutes: Number(cell(layout.columns.break))
      })
    }

    return rows
  }

  function differences(row, shift) {
    const details = []
    if (row.start !== shift.start || row.end !== shift.end) details.push(`${row.start}–${row.end} → ${shift.start}–${shift.end}`)
    if (row.breakMinutes !== shift.breakMinutes) details.push(`Break: ${row.breakMinutes} → ${shift.breakMinutes} minutes`)
    return details
  }

  function planShiftRows(rows, shifts, range) {
    const managedRows = rows.filter(row => row.day >= range.start && row.day <= range.end)
    const days = [...new Set([...managedRows.map(row => row.day), ...shifts.map(shift => shift.day)])]
    const plan = { inserts: [], updates: [], deletes: [], unchangedCount: 0 }

    for (const day of days) {
      const pending = shifts.filter(shift => shift.day === day)
      const unmatched = []

      for (const row of managedRows.filter(row => row.day === day)) {
        const index = pending.findIndex(shift => shift.start === row.start)
        if (index === -1) {
          unmatched.push(row)
          continue
        }

        const [shift] = pending.splice(index, 1)
        const details = differences(row, shift)
        if (details.length) plan.updates.push({ row, shift, details })
        else plan.unchangedCount += 1
      }

      for (const row of unmatched) {
        if (!pending.length) {
          plan.deletes.push(row)
          continue
        }

        const shift = pending.shift()
        plan.updates.push({ row, shift, details: differences(row, shift) })
      }

      plan.inserts.push(...pending)
    }

    return plan
  }

  function dateValue(day, timeZone) {
    return Utilities.parseDate(day, timeZone, "yyyy-MM-dd")
  }

  function timeValue(time, timeZone) {
    return Utilities.parseDate(`1899-12-30 ${time}`, timeZone, "yyyy-MM-dd HH:mm")
  }

  function label(day, start, end, timeZone) {
    return `${Utilities.formatDate(dateValue(day, timeZone), timeZone, "EEE d MMM")}, ${start}–${end}`
  }

  function writeShift(sheet, layout, row, shift, timeZone) {
    sheet.getRange(row, layout.columns.date).setValue(dateValue(shift.day, timeZone))
    sheet.getRange(row, layout.columns.start).setValue(timeValue(shift.start, timeZone))
    sheet.getRange(row, layout.columns.end).setValue(timeValue(shift.end, timeZone))
    sheet.getRange(row, layout.columns.break).setValue(shift.breakMinutes)
  }

  function copyTemplate(sheet, layout, template, target) {
    const width = layout.lastColumn - layout.firstColumn + 1
    sheet.getRange(template, layout.firstColumn, 1, width).copyTo(sheet.getRange(target, layout.firstColumn, 1, width))

    const inputColumns = Object.values(layout.columns)
    sheet.getRange(target, layout.firstColumn, 1, width).getFormulas()[0].forEach((formula, index) => {
      const column = layout.firstColumn + index
      if (!formula && !inputColumns.includes(column)) sheet.getRange(target, column).clearContent()
    })
  }

  function insertShift(sheet, layout, shift, timeZone) {
    const rows = readRows(sheet, layout, timeZone)
    if (!rows.length) {
      writeShift(sheet, layout, layout.headerRow + 1, shift, timeZone)
      return
    }

    const following = rows.find(row => `${row.day} ${row.start}` > `${shift.day} ${shift.start}`)
    const target = following ? following.row : rows[rows.length - 1].row + 1

    if (following) sheet.insertRowBefore(target)
    else sheet.insertRowAfter(target - 1)

    copyTemplate(sheet, layout, target > layout.headerRow + 1 ? target - 1 : target + 1, target)
    writeShift(sheet, layout, target, shift, timeZone)
  }

  function applyPlan(sheet, layout, plan, timeZone) {
    const changes = { added: [], updated: [], removed: [], unchangedCount: plan.unchangedCount }

    for (const update of plan.updates) {
      writeShift(sheet, layout, update.row.row, update.shift, timeZone)
      changes.updated.push({ summary: label(update.shift.day, update.shift.start, update.shift.end, timeZone), details: update.details })
    }

    for (const row of [...plan.deletes].sort((first, second) => second.row - first.row)) {
      changes.removed.push({ summary: label(row.day, row.start, row.end, timeZone), details: [] })
      sheet.deleteRow(row.row)
    }

    for (const shift of [...plan.inserts].sort((first, second) => `${first.day} ${first.start}`.localeCompare(`${second.day} ${second.start}`))) {
      insertShift(sheet, layout, shift, timeZone)
      changes.added.push({ summary: label(shift.day, shift.start, shift.end, timeZone), details: [] })
    }

    return changes
  }

  function sync(active, payload) {
    const sheet = active.getSheets()[0]
    const layout = findLayout(sheet)
    if (!layout) throw new Error(`The shifts sheet needs a header row with ${Object.values(headings).join(", ")}.`)

    const timeZone = active.getSpreadsheetTimeZone()
    const shifts = payload.shifts.map(shift => ({
      day: shift.startDateTime.slice(0, 10),
      start: shift.startDateTime.slice(11, 16),
      end: shift.endDateTime.slice(11, 16),
      breakMinutes: Number(shift.breakMinutes) || 0
    }))
    const plan = planShiftRows(readRows(sheet, layout, timeZone), shifts, { start: payload.syncStart, end: payload.syncEnd })

    return applyPlan(sheet, layout, plan, timeZone)
  }

  function respond(event) {
    try {
      const payload = JSON.parse(event.postData.contents)
      const active = spreadsheet()
      const response = { success: true, spreadsheetUrl: active.getUrl() }
      if (payload.action === "syncSheet") response.changes = sync(active, payload)
      return response
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  globalThis.FourthSheet = { respond, planShiftRows }
})()
