## ADDED Requirements

### Requirement: Mention notifications
When a saved comment or item description contains @-mentions (`@user:...`, `@group:...`, or `@name` shorthand for `user:default/name`), the backend SHALL send a mention notification to each mentioned principal, whether or not they watch the item or board. The acting user SHALL NOT be notified for mentioning themselves, and a principal who is both mentioned and watching SHALL receive only the mention notification for that event.

#### Scenario: Non-watcher is notified on mention
- **WHEN** a user saves a comment containing `@user:default/carol` and carol watches neither the item nor the board
- **THEN** carol receives a "mentioned" notification linking to the item

#### Scenario: Shorthand mention
- **WHEN** a comment contains `@carol`
- **THEN** it is treated as a mention of `user:default/carol`

#### Scenario: No self- or double-notification
- **WHEN** a watching user is mentioned in a comment by another user
- **THEN** they receive exactly one notification for that comment (the mention), and the author receives none for mentioning themselves
