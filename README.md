# Yoroll Game UI Preview

Interactive game UI prototype with page transitions, chapter browsing, and local audio. The desktop 16:9 presentation is preserved; phones use dedicated landscape and portrait layouts with safe areas and touch controls.

Open index.html through a static web server. Login, save files, and game progress are demonstration data.

The gameplay suite is at [playtests/](playtests/). It contains the original test configuration with redesigned web interaction previews, plus adapters for the eight independent Unity gameplay families. It does not bundle or replace those Unity engines. See [the integration contract](playtests/INTEGRATION.md) and [design notes](playtests/DESIGN.md).

Run the gameplay rule and lifecycle checks with `node --test playtests/tests/*.test.cjs`.

Phones activate the mobile presentation automatically. For desktop-browser review, append `?layout=mobile` to either entry point, then resize the viewport; `layout=desktop` explicitly keeps the desktop presentation. Narrow desktop windows alone do not activate phone styles. See the integration contract for portrait game coordinates and engine orientation.
