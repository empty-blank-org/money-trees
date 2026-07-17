# Money Trees Lab

The lab preserves product studies without making them part of the production app.

Each directory in `experiments/` is a frozen, directly runnable experiment. It owns the HTML, renderer/style copies, data snapshots, and optional prep script required to reproduce that view. Experiments must not import another experiment or anything from the production `app/`, `shared/`, or `data/` directories.

`experiments.json` is the catalog source of truth for `/labs/`. Add a catalog entry whenever a new experiment is added.

To promote an experiment, port the winning behavior into the production folders, update the canonical bake and encoding documentation if its data grammar changes, and leave the lab copy intact as design history.
