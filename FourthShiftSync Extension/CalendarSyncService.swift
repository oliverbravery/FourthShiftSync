import EventKit

@MainActor
final class CalendarSyncService {
    private let eventStore = EKEventStore()
    private let timeZone = TimeZone(identifier: "Europe/London")!
    private lazy var fourthDateFormatter = dateFormatter("yyyy-MM-dd'T'HH:mm:ss")
    private lazy var dayParser = dateFormatter("yyyy-MM-dd")
    private lazy var dayFormatter = dateFormatter("EEE d MMM", locale: "en_GB")
    private lazy var timeFormatter = dateFormatter("HH:mm", locale: "en_GB")
    private lazy var calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }()

    func sync(_ request: SyncRequest) async throws -> CalendarChanges {
        try await authoriseCalendar()
        let managedCalendar = try managedCalendar(named: request.calendarName)
        let rangeStart = try parseDay(request.syncStart)
        let rangeEnd = try parseDay(request.syncEnd)
        let predicate = eventStore.predicateForEvents(withStart: rangeStart, end: rangeEnd, calendars: [managedCalendar])
        let managedEvents = eventStore.events(matching: predicate).filter { $0.url?.scheme == "fourthshiftsync" }
        let existingEvents = managedEvents.reduce(into: [Int: EKEvent]()) { events, event in
            if let itemId = event.url.flatMap({ Int($0.lastPathComponent) }) {
                events[itemId] = event
            }
        }
        let shiftIds = Set(request.shifts.map(\.itemId))
        var added: [CalendarChange] = []
        var updated: [CalendarChange] = []
        var removed: [CalendarChange] = []
        var unchangedCount = 0

        for shift in request.shifts {
            let startDate = try parseFourthDate(shift.startDateTime)
            let endDate = try parseFourthDate(shift.endDateTime)

            if let event = existingEvents[shift.itemId] {
                let details = differences(event: event, shift: shift, startDate: startDate, endDate: endDate)
                if details.isEmpty {
                    unchangedCount += 1
                } else {
                    apply(shift: shift, startDate: startDate, endDate: endDate, to: event)
                    try eventStore.save(event, span: .thisEvent, commit: false)
                    updated.append(CalendarChange(summary: "\(dateLabel(startDate)) · \(shift.roleName)", details: details))
                }
            } else {
                let event = EKEvent(eventStore: eventStore)
                event.calendar = managedCalendar
                apply(shift: shift, startDate: startDate, endDate: endDate, to: event)
                try eventStore.save(event, span: .thisEvent, commit: false)
                added.append(CalendarChange(summary: "\(dateLabel(startDate)), \(timeRange(startDate, endDate)) · \(shift.roleName)", details: []))
            }
        }

        for (itemId, event) in existingEvents where !shiftIds.contains(itemId) {
            removed.append(CalendarChange(summary: "\(dateLabel(event.startDate)), \(timeRange(event.startDate, event.endDate)) · \(event.title ?? "Shift")", details: []))
            try eventStore.remove(event, span: .thisEvent, commit: false)
        }

        if !added.isEmpty || !updated.isEmpty || !removed.isEmpty {
            try eventStore.commit()
        }

        return CalendarChanges(added: added, updated: updated, removed: removed, unchangedCount: unchangedCount)
    }

    private func authoriseCalendar() async throws {
        if EKEventStore.authorizationStatus(for: .event) == .notDetermined {
            _ = try await eventStore.requestFullAccessToEvents()
        }
        guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
            throw SyncError.calendarAccess
        }
    }

    private func managedCalendar(named title: String) throws -> EKCalendar {
        if let calendar = eventStore.calendars(for: .event).first(where: { $0.title == title }) {
            return calendar
        }

        guard let source = eventStore.defaultCalendarForNewEvents?.source ?? eventStore.sources.first(where: { $0.sourceType == .local }) else {
            throw SyncError.calendarSource
        }

        let calendar = EKCalendar(for: .event, eventStore: eventStore)
        calendar.title = title
        calendar.source = source
        calendar.cgColor = CGColor(red: 0.07, green: 0.39, blue: 0.23, alpha: 1)
        try eventStore.saveCalendar(calendar, commit: true)
        return calendar
    }

    private func apply(shift: FourthShift, startDate: Date, endDate: Date, to event: EKEvent) {
        event.title = shift.roleName
        event.startDate = startDate
        event.endDate = endDate
        event.timeZone = timeZone
        event.location = shift.locationName
        event.notes = notes(for: shift)
        event.url = URL(string: "fourthshiftsync://shift/\(shift.itemId)")
    }

    private func differences(event: EKEvent, shift: FourthShift, startDate: Date, endDate: Date) -> [String] {
        var details: [String] = []

        if !calendar.isDate(event.startDate, inSameDayAs: startDate) {
            details.append("\(dateLabel(event.startDate)) → \(dateLabel(startDate))")
        }
        if event.startDate != startDate || event.endDate != endDate {
            details.append("\(timeRange(event.startDate, event.endDate)) → \(timeRange(startDate, endDate))")
        }
        if event.title != shift.roleName {
            details.append("\(event.title ?? "Shift") → \(shift.roleName)")
        }
        if event.location != shift.locationName {
            details.append("\(event.location ?? "No location") → \(shift.locationName)")
        }
        if event.notes != notes(for: shift) {
            details.append("Shift notes changed")
        }

        return details
    }

    private func notes(for shift: FourthShift) -> String? {
        var notes: [String] = []
        if shift.breakMinutes > 0 {
            notes.append("Break: \(shift.breakMinutes) minutes")
        }
        if !shift.message.isEmpty {
            notes.append(shift.message)
        }
        return notes.isEmpty ? nil : notes.joined(separator: "\n")
    }

    private func parseFourthDate(_ value: String) throws -> Date {
        guard let date = fourthDateFormatter.date(from: String(value.prefix(19))) else {
            throw SyncError.invalidDate(value)
        }
        return date
    }

    private func parseDay(_ value: String) throws -> Date {
        guard let date = dayParser.date(from: value) else {
            throw SyncError.invalidDate(value)
        }
        return date
    }

    private func dateLabel(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    private func timeRange(_ startDate: Date, _ endDate: Date) -> String {
        "\(timeFormatter.string(from: startDate))–\(timeFormatter.string(from: endDate))"
    }

    private func dateFormatter(_ format: String, locale: String = "en_US_POSIX") -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: locale)
        formatter.timeZone = timeZone
        formatter.dateFormat = format
        return formatter
    }
}
