# Bot avatars

Bot avatars are drawn by [open-bot-avatar](https://github.com/DominikScholz/open-bot-avatar) by Dominik Scholz, installed from npm under the MIT licence (the package carries its `LICENSE`).

The shapes in `avatars.ts` are our own definitions written for that renderer. None are copied from its gallery. Each one is a single path in a `0 0 100 100` box with the eyes placed inside it, and `avatars.test.ts` checks every shape with the package's `validateAvatar`.
