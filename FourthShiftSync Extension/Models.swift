import Foundation

struct FourthShift: Codable {
    let itemId: Int
    let startDateTime: String
    let endDateTime: String
    let locationName: String
    let roleName: String
    let message: String
    let breakMinutes: Int
}

struct SyncRequest: Codable {
    let action: String
    let calendarName: String
    let shifts: [FourthShift]
    let syncStart: String
    let syncEnd: String
}

struct CalendarChange: Codable {
    let summary: String
    let details: [String]
}

struct CalendarChanges: Codable {
    let added: [CalendarChange]
    let updated: [CalendarChange]
    let removed: [CalendarChange]
    let unchangedCount: Int
}

struct SyncResponse: Codable {
    let success: Bool
    let changes: CalendarChanges?
    let error: String?
}

enum SyncError: LocalizedError {
    case calendarAccess
    case calendarSource
    case invalidDate(String)
    case invalidMessage

    var errorDescription: String? {
        switch self {
        case .calendarAccess:
            "Allow Fourth Shift Sync full Calendar access, then try again."
        case .calendarSource:
            "Apple Calendar has no writable calendar source."
        case .invalidDate(let value):
            "Fourth returned an invalid date: \(value)"
        case .invalidMessage:
            "The Safari extension sent an invalid sync request."
        }
    }
}
