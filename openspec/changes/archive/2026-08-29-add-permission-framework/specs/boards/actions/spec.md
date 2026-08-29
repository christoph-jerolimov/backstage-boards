# boards/actions Delta

## ADDED Requirements

### Requirement: Actions honor plugin permissions

When the permission framework is in use, every registered boards action SHALL evaluate the `boards.use` permission for the calling credentials before executing, and actions that create a board SHALL additionally evaluate `boards.new.create`. A DENY decision SHALL fail the action with a permission error and change no data, matching the REST API's behavior for the same caller.

#### Scenario: Action denied without the use permission

- **WHEN** any boards action is invoked with credentials whose policy denies `boards.use`
- **THEN** the action fails with a permission error and no data is changed

#### Scenario: Create-board action honors the create permission

- **WHEN** the `create-board` action is invoked with credentials whose policy denies `boards.new.create`
- **THEN** the action fails with a permission error and no board is created
