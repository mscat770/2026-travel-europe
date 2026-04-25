# Security Specification

## 1. Data Invariants
- `Trip`: Must have an `ownerId`.
- `Event`: Must contain a `dayIndex` and `time`.
- `Todo`: Must belong to a trip and be assigned an `completed` status.

## 2. Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Attempt to create a Trip with someone else's `ownerId`.
2. **Resource Poisoning**: Use a 2KB string for `Event.title`.
3. **Ghost Field**: Add `isVerified: true` to a Trip update.
4. **State Shortcutting**: Change Trip `ownerId` on update.
5. **PII Leak**: Read another user's private data (if any).
6. **Orphaned Write**: Create an Event for a non-existent Trip.
7. **Type Mismatch**: Send `dayIndex` as a string.
8. **Unauthorized Write**: Edit a Trip without being the owner.
9. **Negative Values**: Set an expense amount (if any) to negative.
10. **Shadow Key**: Update `createdAt` field.
11. **Massive Array**: Send a List with 1000 items.
12. **Missing Required**: Create Event without `time`.

## 3. Rules Implementation Strategy
- Global Deny.
- Helpers for `isSignedIn()`, `isValidId()`, `incoming()`, `existing()`.
- `isValidTrip`, `isValidEvent`, `isValidTodo` helpers.
- Use `existsAfter` where needed if relational integrity is required.
