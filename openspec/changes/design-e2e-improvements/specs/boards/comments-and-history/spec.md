# boards/comments-and-history Delta

## ADDED Requirements

### Requirement: Bare web URLs auto-link

When rendering the markdown subset (comments, and every surface that shares it, such as item descriptions), bare `http://` and `https://` URLs appearing in plain text SHALL render as links to that URL, opening in a new tab with the same safety attributes as markdown-form links. A bare URL SHALL NOT be mistaken for a catalog entity ref, and URLs inside inline code or code blocks SHALL stay plain text. Markdown-form links (`[label](https://…)`) SHALL keep working unchanged.

#### Scenario: Bare URL becomes a link

- **WHEN** a comment or description contains `see https://example.com/docs for details`
- **THEN** the rendered text shows `https://example.com/docs` as a link to that URL and the surrounding words as plain text

#### Scenario: URL in code stays plain

- **WHEN** a comment contains `` `https://example.com` `` inside inline code
- **THEN** the URL renders as code text, not as a link

#### Scenario: Markdown-form links are unaffected

- **WHEN** a comment contains `[docs](https://example.com/docs)`
- **THEN** it renders as a link labelled "docs", exactly as before
