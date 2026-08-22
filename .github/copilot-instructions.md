# HomeServer workspace instructions

## Never ask the user to run commands on the server

Every change to the server happens through Gitea Actions. The user does not run
`docker`, `docker compose`, or any other command on the host.

When something needs to happen on the server, deliver it as a workflow step in
the relevant repo's `.gitea/workflows/`, then have the user push or click **Run
workflow** in Gitea. Use `workflow_dispatch` for one-off tasks such as data
imports, migrations, or cleanups.

Only two categories are acceptable as manual host actions, because a workflow
with the Docker socket genuinely cannot perform them:

- installing host packages or drivers (for example the NVIDIA Container Toolkit)
- editing the Docker daemon configuration or restarting the daemon itself

Anything else — copying data into volumes, restarting containers, inspecting
logs, running one-off containers — must be a workflow.

## Architecture facts

- Single Ubuntu host running Docker; ingress is Cloudflare Tunnel, so no ports
  are forwarded and only HTTP/HTTPS/WebSocket traffic reaches services.
- Nginx listens on 8000 and routes by subdomain to `home<slug>.mavsankar.com`.
- All containers join the external `homeserver` network.
- Gitea and its runner are the CI/CD system; each service is its own repo.
- Backrest backs up `/var/lib/docker/volumes` only. Data that must survive a
  restore belongs in a **named volume**, never a host bind mount.
- Secrets come from Gitea Actions secrets; non-secret settings from Gitea
  Actions variables.

## Disaster recovery

`infra/bootstrap/restore-from-backrest.sh` is the one exception to the no-manual
rule: it is copied to a new machine and run there, because it must exist before
Gitea does.
