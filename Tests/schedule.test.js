const test = require("node:test")
const assert = require("node:assert/strict")

global.location = { origin: "https://api.fourth.com" }
require("../FourthShiftSync Extension/Resources/schedule.js")

test("formats Fourth API dates", () => {
    assert.equal(FourthSchedule.formatAPIDate(new Date(2026, 6, 4)), "2026/07/04")
})

test("uses a one-year sync range", () => {
    assert.deepEqual(FourthSchedule.syncRange(new Date(2026, 6, 12, 18)), {
        start: "2026/07/12",
        end: "2027/07/12"
    })
})

test("returns shifts and excludes unavailability", async () => {
    const requests = []
    const fetcher = async url => {
        requests.push(url)
        return {
            ok: true,
            json: async () => ({
                properties: { totalRows: 2 },
                entities: [
                    { properties: { itemId: 1, scheduleItemType: "Shift" } },
                    { properties: { itemId: 2, scheduleItemType: "UnavailabilitySeries" } }
                ]
            })
        }
    }

    const schedule = await FourthSchedule.fetchShifts(fetcher, new Date(2026, 6, 12))

    assert.deepEqual(schedule.shifts, [{ itemId: 1, scheduleItemType: "Shift" }])
    assert.equal(schedule.syncStart, "2026-07-12")
    assert.equal(requests[0].searchParams.get("$top"), "100")
    assert.equal(requests[0].searchParams.get("fromDate"), "2026/07/12")
})
