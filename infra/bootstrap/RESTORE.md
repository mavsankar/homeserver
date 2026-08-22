# HomeServer One-Script Migration

The old machine remains online while the new machine downloads its Backrest
snapshot. The script then pauses so you can shut down the old machine before
the new runner and public Cloudflare tunnel are activated.

## What you need

- `restore-from-backrest.sh` copied to the new Ubuntu machine
- the Restic repository password from Backrest
- the HTTP basic-auth username and password for
  `homerestic.mavsankar.com`

The REST credentials are the `RESTIC_REST_USERNAME` and
`RESTIC_REST_PASSWORD` secrets in the Gitea `backup` repository. They are
different from the Restic repository encryption password.

Kavita's external books directory and Zipline's bind-mounted directories are
accepted exclusions. All named Docker volumes found in the snapshot are
restored automatically.

## Run the migration

Keep the old machine running and execute this on the new machine:

```bash
chmod +x restore-from-backrest.sh
sudo ./restore-from-backrest.sh
```

The script asks for:

1. The repository URL, including the repository directory name, for example
   `rest:https://homerestic.mavsankar.com/homeserver/`. Backrest stores each
   repo as a subdirectory of the volume that `restic-rest` serves, so the URL
   root usually holds no repository. The `backup` deploy workflow prints the
   available paths.
2. The REST server username
3. The REST server password
4. The Restic repository password
5. Confirmation before creating the restored volumes

REST credentials are passed through Restic's dedicated environment variables,
so passwords containing `@`, `:`, or other URL characters are entered normally
and do not need percent-encoding.
The script uses the latest completed snapshot by default. To select an exact
snapshot instead:

```bash
sudo SNAPSHOT=SNAPSHOT_ID ./restore-from-backrest.sh
```

## Shutdown checkpoint

The script performs the entire download while the old machine is still
running. It restores every named volume, generates the bootstrap configuration,
starts Gitea locally, and verifies that Gitea is healthy. It does not start the
runner or Cloudflare tunnel yet.

When this prompt appears:

```text
After the old machine is fully powered off, type OLD-HOST-OFF:
```

shut down the old machine, wait until it is fully off, and then enter
`OLD-HOST-OFF` on the new machine.

The script then automatically:

- starts or re-registers the restored Gitea Actions runner;
- discovers repositories in restored Gitea;
- pushes an empty commit to each repository containing a deploy workflow;
- queues the existing Gitea Actions deployments;
- queues `reverse-proxy` last so the new Cloudflare tunnel activates last; and
- leaves the bootstrap files in `/opt/homeserver-bootstrap`.

No code needs to be copied or pushed manually. Gitea repositories, Actions
secrets, and named-volume data all come from the Restic snapshot.

## After completion

Open `http://NEW_MACHINE_IP:3000` to follow Actions progress. Check the public
service URLs after the reverse-proxy workflow completes. Keep the old machine
powered off but intact until all services work and the new Backrest instance
has completed a backup.

The automation creates a random Gitea access token to discover repositories
and push the deployment commits. It never prints or saves the token, and the
value is discarded when the script exits.

## Data consistency

Because this restores an already completed six-hour snapshot, changes made on
the old machine after that snapshot are not included. For the smallest data
loss, run the migration immediately after a successful scheduled backup.

The script refuses to continue if the snapshot does not contain paths shaped
like `/userdata/<volume-name>/_data` or if the Gitea data volume is missing. It
also refuses to overwrite non-empty volumes on the new machine.
