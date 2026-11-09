# audit-home-tilde

A profile home shaped like the 0.20.12 `audit --home` report: one declared
plugin whose `dsh.bundle.patch` points at `./missing.yml`, which was never
installed. The profile is otherwise clean, so the only failure the audit can
print is the missing patch file.

The fixture lives under `home/.dsh`, so a test can point `HOME` at `home/` and
pass the literal spelling `~/.dsh` (or the Windows `~\.dsh`) through the
shipped CLI. That is the string `cmd` and PowerShell hand to the program; a
leading `~` must expand to this fixture, not to a folder literally named `~`
in the current working directory.

```sh
node ../../../bin/dsh-plugin.mjs audit --home '~/.dsh'
```

With `HOME` pointing at this fixture's `home/`, the command prints the
`broken` row, names `./missing.yml`, and exits `1`.
