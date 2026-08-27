# Design

BUI `Menu` forwards `placement` to its popover. The two menus with
`SubmenuTrigger` children (item menu, column menu) set
`placement="right top"`. Submenus themselves keep their default flyout
placement.
