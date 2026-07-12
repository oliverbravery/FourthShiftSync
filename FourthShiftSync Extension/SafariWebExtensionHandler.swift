import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let input = context.inputItems.first as? NSExtensionItem,
              let message = input.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let data = try? JSONSerialization.data(withJSONObject: message),
              let request = try? JSONDecoder().decode(SyncRequest.self, from: data),
              request.action == "syncCalendar" else {
            complete(context, with: SyncResponse(success: false, changes: nil, error: SyncError.invalidMessage.localizedDescription))
            return
        }

        Task { @MainActor in
            do {
                let changes = try await CalendarSyncService().sync(request)
                complete(context, with: SyncResponse(success: true, changes: changes, error: nil))
            } catch {
                complete(context, with: SyncResponse(success: false, changes: nil, error: error.localizedDescription))
            }
        }
    }

    private func complete(_ context: NSExtensionContext, with response: SyncResponse) {
        let item = NSExtensionItem()
        let data = try! JSONEncoder().encode(response)
        item.userInfo = [SFExtensionMessageKey: try! JSONSerialization.jsonObject(with: data)]
        context.completeRequest(returningItems: [item])
    }
}
