## ADDED Requirements

### Requirement: Catalog-backed principal selection
The share dialog SHALL offer autocomplete over the catalog's User and Group entities when adding a permission entry, and SHALL NOT offer a free-text option (share principals must be catalog users or groups).

#### Scenario: Pick a share principal
- **WHEN** a board admin types into the share dialog's principal picker
- **THEN** matching catalog users and groups are suggested and selecting one fills the entry to add

#### Scenario: No free-text principals
- **WHEN** a board admin's input matches no catalog user or group
- **THEN** no free-text option is offered and nothing can be added from that input
