# Yoroll Game UI Preview

Interactive desktop 16:9 UI prototype with page transitions, chapter browsing, and local audio.

Open index.html through a static web server. Login, save files, and game progress are demonstration data.

The gameplay suite is at [playtests/](playtests/). It contains the original test configuration with redesigned web interaction previews, plus adapters for the eight independent Unity gameplay families. It does not bundle or replace those Unity engines. See [the integration contract](playtests/INTEGRATION.md) and [design notes](playtests/DESIGN.md).

Run the gameplay rule and lifecycle checks with `node --test playtests/tests/*.test.cjs`.
