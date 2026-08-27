## ADDED Requirements

### Requirement: Mention rendering
@-mentions in comments and descriptions SHALL render as links to the mentioned catalog entity, alongside the existing bare entity-ref auto-linking. `text:` refs remain unlinked.

#### Scenario: Mention renders as entity link
- **WHEN** a comment containing `@user:default/jane` or `@jane` is rendered
- **THEN** the mention appears as a link to that user's catalog page
