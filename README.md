# hyf-plan

A tool to generate GitHub issues for tracking HYF modules in progress.

Inspired by the VSCode Iteration Plans, e.g.: https://github.com/Microsoft/vscode/issues/71059

## Installation

Install the dependencies:

```
npm install
```

Run the application:

```
npm start [<class>.<module>]
```

## Install as CLI (optional)

```
npm link
```

Run:

```
hyfplan  [<class>.<module>]
```

## YAML files

All data is provided through a set of YAML files, as detailed in the table below.

| Filename | Folder | Example | Description |
|----------|--------|---------|-------------|
| `templates.yml` | data | - | Defines default template definitions. |
| `<class>.yml` | `data/classes` | `class20.yml` | Defines the display name of the class and the list of students (i.e. their GitHub names). May include template overrides. |
| `<module>.yml` | `data/modules` | `node.yml` | Defines the display name of the module. May include template overrides.  |
| `<class>.<module>.yml` | `data/plans` | `class20.node.yml` | Defines the names of the teachers and the lecture dates. May include template overrides. |

The various YAML files are implicitly linked through a naming convention. For example, the file named `class20.node.yml` from the `data/plans` folder implicitly references the file `class20.yml` from the classes folder and `node.yml` from the modules folder.

The `templates.yml` file defines default template definitions.

> A template is just a text string which may include predefined replaceable parameters, wrapped in curly braces, e.g. `{{className}}`.

The default templates may be overridden in the `<module>.yml`, `<class>.yml` and `<class>.<module>.yml` files, in the order specified.

## Usage

When the application is started without command line parameters a list of 'plans' (i.e. available YAML files from the `data/plans` folder is shown from which a plan can be selected. Only plans for which the first lecture date lies in the future are shown.

After selection of a plan the application generates a markdown file, the contents of which can be used as a (i.e. to paste into) GitHub issue.

## Suggested GitHub Usage

We can use a GitHub **issue** in combination with a **milestone**. As there is a separate menu option in GitHub to find **milestones** we can easily get an overview of all milestones, their status and their associated issues.

1. Go to the GitHub repository for the target HYF module, e.g., **Node.js**.
2. Create a new **milestone** and set an appropriate title, e.g. **Class 20** and set the due date to the date of the last lecture + 1 week (to allow for homework).
3. Create a new GitHub **issue** and copy and paste the content of the generated markdown file.
4. Associate the **issue** with the **milestone** created previously.
5. Pin the *issue* (unpin an older issue if needed).

Example: https://github.com/HackYourFuture/Node.js/milestones
