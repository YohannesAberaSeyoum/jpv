jpv
=================

A CLI to manage playlist of youtube and file using mpv


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/jpv.svg)](https://npmjs.org/package/jpv)
[![Downloads/week](https://img.shields.io/npm/dw/jpv.svg)](https://npmjs.org/package/jpv)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g jpv
$ jpv COMMAND
running command...
$ jpv (--version)
jpv/0.0.0 linux-x64 node-v22.5.1
$ jpv --help [COMMAND]
USAGE
  $ jpv COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`jpv hello PERSON`](#jpv-hello-person)
* [`jpv hello world`](#jpv-hello-world)
* [`jpv help [COMMAND]`](#jpv-help-command)
* [`jpv plugins`](#jpv-plugins)
* [`jpv plugins add PLUGIN`](#jpv-plugins-add-plugin)
* [`jpv plugins:inspect PLUGIN...`](#jpv-pluginsinspect-plugin)
* [`jpv plugins install PLUGIN`](#jpv-plugins-install-plugin)
* [`jpv plugins link PATH`](#jpv-plugins-link-path)
* [`jpv plugins remove [PLUGIN]`](#jpv-plugins-remove-plugin)
* [`jpv plugins reset`](#jpv-plugins-reset)
* [`jpv plugins uninstall [PLUGIN]`](#jpv-plugins-uninstall-plugin)
* [`jpv plugins unlink [PLUGIN]`](#jpv-plugins-unlink-plugin)
* [`jpv plugins update`](#jpv-plugins-update)

## `jpv hello PERSON`

Say hello

```
USAGE
  $ jpv hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ jpv hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/YohannesAberaSeyoum/jpv/blob/v0.0.0/src/commands/hello/index.ts)_

## `jpv hello world`

Say hello world

```
USAGE
  $ jpv hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ jpv hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/YohannesAberaSeyoum/jpv/blob/v0.0.0/src/commands/hello/world.ts)_

## `jpv help [COMMAND]`

Display help for jpv.

```
USAGE
  $ jpv help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for jpv.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.11/src/commands/help.ts)_

## `jpv plugins`

List installed plugins.

```
USAGE
  $ jpv plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ jpv plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/index.ts)_

## `jpv plugins add PLUGIN`

Installs a plugin into jpv.

```
USAGE
  $ jpv plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into jpv.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the JPV_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the JPV_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ jpv plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ jpv plugins add myplugin

  Install a plugin from a github url.

    $ jpv plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ jpv plugins add someuser/someplugin
```

## `jpv plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ jpv plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ jpv plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/inspect.ts)_

## `jpv plugins install PLUGIN`

Installs a plugin into jpv.

```
USAGE
  $ jpv plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into jpv.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the JPV_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the JPV_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ jpv plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ jpv plugins install myplugin

  Install a plugin from a github url.

    $ jpv plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ jpv plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/install.ts)_

## `jpv plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ jpv plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ jpv plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/link.ts)_

## `jpv plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ jpv plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ jpv plugins unlink
  $ jpv plugins remove

EXAMPLES
  $ jpv plugins remove myplugin
```

## `jpv plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ jpv plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/reset.ts)_

## `jpv plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ jpv plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ jpv plugins unlink
  $ jpv plugins remove

EXAMPLES
  $ jpv plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/uninstall.ts)_

## `jpv plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ jpv plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ jpv plugins unlink
  $ jpv plugins remove

EXAMPLES
  $ jpv plugins unlink myplugin
```

## `jpv plugins update`

Update installed plugins.

```
USAGE
  $ jpv plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.7/src/commands/plugins/update.ts)_
<!-- commandsstop -->
