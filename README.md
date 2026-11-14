# Gloamwater

A single-file trading game: thirty nights running cargo through a drowned, lantern-lit city.
Play [Gloamwater online](https://travissaylor.github.io/gloamwater/), or open [game/index.html](game/index.html) locally.
Design notes are in [NOTES.md](NOTES.md).

Gloamwater won a four-model bake-off built from [BRIEF.md](BRIEF.md) and scored against
[RUBRIC.md](RUBRIC.md). The bake-off score files are in `judging/bakeoff/`.

Current work, targets and the judging process: [GOALS.md](GOALS.md).
Browser tooling for testing: [tools/README.md](tools/README.md).

## Deploy updates

The [deployment workflow](.github/workflows/deploy-pages.yml) publishes `game/` to GitHub Pages without a build step.
Changes to `game/` on `main` publish automatically. To republish manually, run **Deploy Gloamwater** from `main`.

To set up GitHub Pages for a new copy of this repository:

1. Open the repository's [Pages settings](https://github.com/travissaylor/gloamwater/settings/pages).
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge the deployment workflow into `main`.
4. Wait for **Deploy Gloamwater** in [Actions](https://github.com/travissaylor/gloamwater/actions) to succeed.

The deployed URL appears in the workflow's **github-pages** environment.

On iPhone, open the link in Safari. Use **Share > Add to Home Screen** for a shortcut.
Voyages and high scores stay in that browser's local storage; they do not sync between devices.
Saved games from a local file do not transfer to the hosted address.
