const test = require("node:test")
const assert = require("node:assert/strict")

require("../AppsScript/Code.js")

const range = { start: "2026-08-14", end: "2027-08-14" }

function row(number, day, start, end, breakMinutes = 0) {
    return { row: number, day, start, end, breakMinutes }
}

function shift(day, start, end, breakMinutes = 0) {
    return { day, start, end, breakMinutes }
}

test("leaves matching rows alone", () => {
    const plan = FourthSheet.planShiftRows([row(20, "2026-08-15", "12:00", "18:00")], [shift("2026-08-15", "12:00", "18:00")], range)

    assert.deepEqual(plan.inserts, [])
    assert.deepEqual(plan.updates, [])
    assert.deepEqual(plan.deletes, [])
    assert.equal(plan.unchangedCount, 1)
})

test("never touches rows before the sync range", () => {
    const plan = FourthSheet.planShiftRows([row(20, "2026-06-09", "12:00", "18:00")], [], range)

    assert.deepEqual(plan.deletes, [])
    assert.deepEqual(plan.updates, [])
    assert.equal(plan.unchangedCount, 0)
})

test("updates a row whose times or break changed", () => {
    const plan = FourthSheet.planShiftRows(
        [row(20, "2026-08-15", "12:00", "18:00")],
        [shift("2026-08-15", "12:00", "23:30", 30)],
        range
    )

    assert.equal(plan.updates.length, 1)
    assert.equal(plan.updates[0].row.row, 20)
    assert.deepEqual(plan.updates[0].details, ["12:00–18:00 → 12:00–23:30", "Break: 0 → 30 minutes"])
    assert.deepEqual(plan.deletes, [])
    assert.deepEqual(plan.inserts, [])
})

test("keeps a same-day row when the start time moves", () => {
    const plan = FourthSheet.planShiftRows(
        [row(20, "2026-08-15", "12:00", "18:00")],
        [shift("2026-08-15", "15:00", "21:00")],
        range
    )

    assert.equal(plan.updates.length, 1)
    assert.deepEqual(plan.updates[0].details, ["12:00–18:00 → 15:00–21:00"])
    assert.deepEqual(plan.inserts, [])
})

test("matches split shifts on the same day by start time", () => {
    const plan = FourthSheet.planShiftRows(
        [row(20, "2026-08-15", "18:00", "23:00"), row(21, "2026-08-15", "10:00", "14:00")],
        [shift("2026-08-15", "10:00", "14:00"), shift("2026-08-15", "18:00", "00:30")],
        range
    )

    assert.equal(plan.unchangedCount, 1)
    assert.equal(plan.updates.length, 1)
    assert.equal(plan.updates[0].row.row, 20)
    assert.deepEqual(plan.inserts, [])
    assert.deepEqual(plan.deletes, [])
})

test("inserts shifts the sheet is missing", () => {
    const plan = FourthSheet.planShiftRows([], [shift("2026-08-20", "15:00", "21:00")], range)

    assert.deepEqual(plan.inserts, [shift("2026-08-20", "15:00", "21:00")])
})

test("deletes in-range rows Fourth no longer has", () => {
    const plan = FourthSheet.planShiftRows(
        [row(20, "2026-06-09", "12:00", "18:00"), row(21, "2026-08-20", "15:00", "21:00")],
        [],
        range
    )

    assert.deepEqual(plan.deletes.map(row => row.row), [21])
})
