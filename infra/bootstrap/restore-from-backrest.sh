#!/usr/bin/env bash
set -Eeuo pipefail

readonly RESTIC_IMAGE="${RESTIC_IMAGE:-restic/restic:latest}"
readonly COPY_IMAGE="${COPY_IMAGE:-alpine:3.20}"
readonly SNAPSHOT="${SNAPSHOT:-latest}"
readonly BOOTSTRAP_DIR="${BOOTSTRAP_DIR:-/opt/homeserver-bootstrap}"
readonly SKIP_RESTORE="${SKIP_RESTORE:-0}"
readonly LIST_FILE="$(mktemp)"
readonly REPOS_FILE="$(mktemp)"
readonly CLONE_DIR="$(mktemp -d)"
GITEA_TOKEN=""

cleanup() {
  rm -f "$LIST_FILE" "$REPOS_FILE" "$REPOS_FILE.next"
  rm -rf "$CLONE_DIR"
}
trap cleanup EXIT

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || fail "Run this script with sudo."

if [[ $SKIP_RESTORE == 1 ]]; then
  RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-none}"
  RESTIC_PASSWORD="${RESTIC_PASSWORD:-none}"
fi

if [[ -z ${RESTIC_REPOSITORY:-} ]]; then
  read -r -p "Restic repository URL [rest:https://homerestic.mavsankar.com/]: " RESTIC_REPOSITORY
  RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-rest:https://homerestic.mavsankar.com/}"
fi

normalized_repository="$(
  printf '%s\n' "$RESTIC_REPOSITORY" |
    sed -nE 's#^rest:\[([^]]+)\]\([^)]+\)/?$#rest:\1#p'
)"
if [[ -n $normalized_repository ]]; then
  RESTIC_REPOSITORY="$normalized_repository"
  printf 'Using normalized repository URL: %s\n' "$RESTIC_REPOSITORY"
fi
[[ $RESTIC_REPOSITORY != *'['* && $RESTIC_REPOSITORY != *']'* && \
   $RESTIC_REPOSITORY != *'('* && $RESTIC_REPOSITORY != *')'* ]] || fail \
  "Repository URL contains Markdown characters. Use rest:https://homerestic.mavsankar.com/"
export RESTIC_REPOSITORY

if [[ $RESTIC_REPOSITORY == rest:http* ]]; then
  if [[ -z ${RESTIC_REST_USERNAME:-} ]]; then
    read -r -p "REST server username: " RESTIC_REST_USERNAME
    export RESTIC_REST_USERNAME
  fi

  if [[ -z ${RESTIC_REST_PASSWORD:-} ]]; then
    read -r -s -p "REST server password: " RESTIC_REST_PASSWORD
    printf '\n'
    export RESTIC_REST_PASSWORD
  fi

fi

if [[ -z ${RESTIC_PASSWORD:-} ]]; then
  read -r -s -p "Restic repository password: " RESTIC_PASSWORD
  printf '\n'
  export RESTIC_PASSWORD
fi

if ! command -v docker >/dev/null 2>&1; then
  command -v curl >/dev/null 2>&1 || {
    apt-get update
    apt-get install -y ca-certificates curl git jq
  }
  curl -fsSL https://get.docker.com | sh
fi

missing_packages=()
command -v curl >/dev/null 2>&1 || missing_packages+=(curl)
command -v git >/dev/null 2>&1 || missing_packages+=(git)
command -v jq >/dev/null 2>&1 || missing_packages+=(jq)
if ((${#missing_packages[@]} > 0)); then
  apt-get update
  apt-get install -y ca-certificates "${missing_packages[@]}"
fi

if [[ $RESTIC_REPOSITORY == rest:http* ]]; then
  rest_http_url="${RESTIC_REPOSITORY#rest:}"
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -u "$RESTIC_REST_USERNAME:$RESTIC_REST_PASSWORD" "${rest_http_url%/}/config")" ||
    fail "Could not connect to $rest_http_url."
  [[ $http_status != 401 && $http_status != 403 ]] || fail \
    "REST server rejected the username/password (HTTP $http_status). Check the backup repo's RESTIC_REST_USERNAME and RESTIC_REST_PASSWORD Gitea secrets."
  [[ $http_status != 404 ]] || fail \
    "No restic repository at $rest_http_url. Backrest serves each repo as a subdirectory, so append its name, for example ${RESTIC_REPOSITORY%/}/homeserver/"
  [[ $http_status -lt 500 ]] || fail \
    "REST server returned HTTP $http_status from $rest_http_url."
fi

systemctl enable --now docker
docker info >/dev/null
[[ $SKIP_RESTORE == 1 ]] || docker pull "$RESTIC_IMAGE" >/dev/null
docker pull "$COPY_IMAGE" >/dev/null

restic() {
  docker run --rm \
    -e RESTIC_REPOSITORY \
    -e RESTIC_PASSWORD \
    -e RESTIC_REST_USERNAME \
    -e RESTIC_REST_PASSWORD \
    "$RESTIC_IMAGE" "$@"
}

if [[ $SKIP_RESTORE == 1 ]]; then
  printf 'SKIP_RESTORE=1: keeping the volumes already restored and resuming activation.\n'
else
  printf 'Inspecting snapshot %s...\n' "$SNAPSHOT"
  restic snapshots "$SNAPSHOT"
  restic ls "$SNAPSHOT" > "$LIST_FILE"

  mapfile -t volumes < <(
    sed -nE 's#^/?userdata/([A-Za-z0-9_.-]+)/_data(/.*)?$#\1#p' "$LIST_FILE" |
      sort -u
  )

  ((${#volumes[@]} > 0)) || fail \
    "Snapshot $SNAPSHOT has no /userdata/<volume>/_data paths. Verify the Backrest plan before restoring."

  if [[ ! " ${volumes[*]} " =~ " homeserver-bootstrap_gitea-data " ]]; then
    fail "Snapshot $SNAPSHOT does not contain homeserver-bootstrap_gitea-data. Gitea cannot be bootstrapped from it."
  fi

  printf '\nThe following %d Docker volumes will be created and restored:\n' "${#volumes[@]}"
  printf '  %s\n' "${volumes[@]}"
  printf '\nExisting non-empty volumes will never be overwritten.\n'

  if [[ ${ASSUME_YES:-0} != 1 ]]; then
    read -r -p "Continue? Type RESTORE: " confirmation
    [[ $confirmation == RESTORE ]] || fail "Restore cancelled."
  fi

  for volume in "${volumes[@]}"; do
    printf '\nRestoring %s...\n' "$volume"
    docker volume create "$volume" >/dev/null

    if ! docker run --rm -v "$volume:/restore" "$COPY_IMAGE" \
      sh -c 'test -z "$(find /restore -mindepth 1 -maxdepth 1 -print -quit)"'; then
      fail "Volume $volume is not empty. Remove it manually only if you are certain it contains no needed data."
    fi

    docker run --rm \
      -e RESTIC_REPOSITORY \
      -e RESTIC_PASSWORD \
      -e RESTIC_REST_USERNAME \
      -e RESTIC_REST_PASSWORD \
      -v "$volume:/restore" \
      "$RESTIC_IMAGE" restore "$SNAPSHOT:/userdata/$volume/_data" --target /restore
  done
fi

docker network inspect homeserver >/dev/null 2>&1 || docker network create homeserver >/dev/null

mkdir -p "$BOOTSTRAP_DIR"
cat > "$BOOTSTRAP_DIR/docker-compose.yml" <<'COMPOSE'
name: homeserver-bootstrap

services:
  gitea:
    image: gitea/gitea:latest
    container_name: gitea
    restart: always
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__server__DOMAIN=homegit.mavsankar.com
      - GITEA__server__SSH_DOMAIN=homegit.mavsankar.com
      - GITEA__server__ROOT_URL=https://homegit.mavsankar.com/
      - GITEA__server__PUBLIC_URL_DETECTION=never
      - GITEA__server__HTTP_PORT=3000
      - GITEA__database__DB_TYPE=sqlite3
      - GITEA__actions__ENABLED=true
      - GITEA__service__DISABLE_REGISTRATION=true
      - GITEA__service__SHOW_REGISTRATION_BUTTON=false
      - GITEA__repository__DEFAULT_PRIVATE=private
      - GITEA__repository__FORCE_PRIVATE=true
    volumes:
      - gitea-data:/data
    ports:
      - "3000:3000"
      - "2222:22"
    networks:
      - homeserver

  gitea-runner:
    image: gitea/act_runner:latest
    container_name: gitea-runner
    restart: always
    environment:
      - GITEA_INSTANCE_URL=http://gitea:3000
      - GITEA_RUNNER_REGISTRATION_TOKEN=${RUNNER_TOKEN}
      - GITEA_RUNNER_NAME=homeserver-runner
      - GITEA_RUNNER_LABELS=ubuntu-latest:docker://node:20-alpine
      - CONFIG_FILE=/data/runner-config.yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - gitea-runner-data:/data
    networks:
      - homeserver

volumes:
  gitea-data:
  gitea-runner-data:

networks:
  homeserver:
    external: true
    name: homeserver
COMPOSE

cat > "$BOOTSTRAP_DIR/runner-config.yaml" <<'RUNNER_CONFIG'
log:
  level: info

runner:
  file: .runner
  capacity: 1
  timeout: 3h

container:
  network: "homeserver"
  privileged: false
  docker_host: ""
  valid_volumes:
    - "**"
RUNNER_CONFIG

printf 'RUNNER_TOKEN=\n' > "$BOOTSTRAP_DIR/.env"
chmod 600 "$BOOTSTRAP_DIR/.env"

(
  cd "$BOOTSTRAP_DIR"
  docker compose config >/dev/null
  docker compose up -d gitea
)

printf '\nWaiting for restored Gitea to become ready...\n'
for attempt in {1..60}; do
  if curl -fsS http://127.0.0.1:3000/api/healthz >/dev/null; then
    break
  fi
  ((attempt == 60)) && fail "Gitea did not become healthy within five minutes."
  sleep 5
done

printf '\nThe backup has been restored and Gitea is healthy on this machine.\n'
printf 'Shut down the old machine now. This script will not start the runner or public tunnel until you confirm.\n'
read -r -p "After the old machine is fully powered off, type OLD-HOST-OFF: " confirmation
[[ $confirmation == OLD-HOST-OFF ]] || fail "Activation cancelled; restored data remains intact."

gitea_cli() {
  docker exec --user git gitea gitea --config /data/gitea/conf/app.ini "$@"
}

admin_user="${GITEA_ADMIN:-}"
if [[ -z $admin_user ]]; then
  admin_user="$(gitea_cli admin user list --admin | awk '$1 ~ /^[0-9]+$/ {print $2; exit}')"
fi
[[ -n $admin_user ]] || fail "No Gitea administrator was found in the restored data."

token_name="restore-$(date +%s)"
GITEA_TOKEN="$(
  gitea_cli admin user generate-access-token \
    --username "$admin_user" \
    --token-name "$token_name" \
    --scopes all |
    sed -nE 's/.*created: ([[:alnum:]_-]+).*/\1/p'
)"
[[ -n $GITEA_TOKEN ]] || fail "Gitea did not return a temporary access token."

api_get() {
  curl -fsS --max-time 15 -H "Authorization: token $GITEA_TOKEN" "http://127.0.0.1:3000/api/v1$1"
}

runner_token="$(gitea_cli actions generate-runner-token | tail -n 1 | tr -d '\r')"
[[ -n $runner_token ]] || fail "Gitea did not return a runner registration token."
printf 'RUNNER_TOKEN=%s\n' "$runner_token" > "$BOOTSTRAP_DIR/.env"
chmod 600 "$BOOTSTRAP_DIR/.env"

(
  cd "$BOOTSTRAP_DIR"
  docker run --rm -i -v homeserver-bootstrap_gitea-runner-data:/data "$COPY_IMAGE" \
    sh -c 'cat > /data/runner-config.yaml' < runner-config.yaml
  docker compose up -d gitea-runner
)

printf '\nChecking the Gitea runner (up to 60 seconds)...\n'
runner_online=0
for attempt in {1..12}; do
  if api_get "/admin/actions/runners?limit=100" 2>/dev/null |
    jq -e '.runners[]? | select(.status == "active" or .status == "idle")' >/dev/null 2>&1; then
    runner_online=1
    break
  fi
  sleep 5
done

if ((runner_online == 0)); then
  printf 'Runner status could not be confirmed through the API; continuing anyway.\n'
  printf 'Container state: %s\n' \
    "$(docker inspect -f '{{.State.Status}}' gitea-runner 2>/dev/null || echo missing)"
  docker logs --tail 20 gitea-runner 2>&1 || true
  printf 'Queued jobs will start as soon as the runner connects.\n'
fi

page=1
printf '[]\n' > "$REPOS_FILE"
while :; do
  response="$(api_get "/repos/search?limit=50&page=$page&private=true")"
  count="$(jq '.data | length' <<< "$response")"
  ((count > 0)) || break
  jq -s '.[0] + .[1].data' "$REPOS_FILE" <(printf '%s\n' "$response") > "$REPOS_FILE.next"
  mv "$REPOS_FILE.next" "$REPOS_FILE"
  ((page++))
done

trigger_deploy() {
  local full_name=$1
  local default_branch=$2
  local repo_dir="$CLONE_DIR/${full_name//\//__}"
  local repo_url="http://127.0.0.1:3000/$full_name.git"

  git -c "http.extraHeader=Authorization: token $GITEA_TOKEN" clone --quiet "$repo_url" "$repo_dir"
  if [[ ! -f "$repo_dir/.gitea/workflows/deploy.yml" && ! -f "$repo_dir/.gitea/workflows/deploy.yaml" ]]; then
    return
  fi

  printf 'Triggering deployment for %s...\n' "$full_name"
  git -C "$repo_dir" config user.name "HomeServer Restore"
  git -C "$repo_dir" config user.email "restore@localhost"
  git -C "$repo_dir" commit --allow-empty -m "Trigger deployment after server restore" >/dev/null
  git -C "$repo_dir" -c "http.extraHeader=Authorization: token $GITEA_TOKEN" \
    push --quiet origin "HEAD:$default_branch"
}

while IFS=$'\t' read -r full_name default_branch; do
  # infra redeploys the runner this migration depends on, so it is left for a manual push
  case ${full_name##*/} in
    reverse-proxy | infra) continue ;;
  esac
  trigger_deploy "$full_name" "$default_branch"
done < <(jq -r '.[] | [.full_name, .default_branch] | @tsv' "$REPOS_FILE")

while IFS=$'\t' read -r full_name default_branch; do
  [[ ${full_name##*/} == reverse-proxy ]] || continue
  trigger_deploy "$full_name" "$default_branch"
done < <(jq -r '.[] | [.full_name, .default_branch] | @tsv' "$REPOS_FILE")

cat <<'EOF'

Restore and activation are complete. Gitea Actions deployments have been queued,
with reverse-proxy queued last. Follow progress at http://NEW_MACHINE_IP:3000.

The infra repo was skipped on purpose because its workflow redeploys this
runner. Push it from your workstation once the other services are up; that
also deploys glances and speedtest-tracker.

Keep the old machine powered off but intact until all services and a new backup
have been verified.
EOF
