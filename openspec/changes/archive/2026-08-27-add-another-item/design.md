# Design

`AddItemRow` currently sets `editing` to false after a successful add.
Instead it keeps `editing` true, clears the draft, and refocuses the
text field (ref + `requestAnimationFrame`, since the field re-renders
after the async add). Blur with an empty draft still closes the form so
the open form does not linger when the user clicks elsewhere.
