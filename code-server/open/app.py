"""Clone-on-demand bridge between Gitea and code-server.

GET /_open?repo=<owner>/<name>[&ref=<branch>]
  -> clones or fetches the repo into the code-server workspace volume
  -> 302 redirects to code-server with that folder opened

Access is gated on the caller already holding a valid code-server session
cookie, so this endpoint is no more exposed than the editor itself.
"""

import base64
import html
import os
import re
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

GITEA_URL = os.environ["GITEA_URL"].rstrip("/")
GITEA_TOKEN = os.environ["GITEA_TOKEN"]
CODE_SERVER_URL = os.environ["CODE_SERVER_URL"].rstrip("/")
CODE_SERVER_INTERNAL = os.environ["CODE_SERVER_INTERNAL"].rstrip("/")
WORKSPACE_ROOT = os.environ.get("WORKSPACE_ROOT", "/config/workspace")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8090"))

# Leading alphanumeric blocks both "-flag" style argument injection and "..".
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
REF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$")

# Credentials ride in the environment so they never reach argv or .git/config.
GIT_ENV = {
    **os.environ,
    "GIT_TERMINAL_PROMPT": "0",
    "GIT_CONFIG_COUNT": "2",
    "GIT_CONFIG_KEY_0": f"http.{GITEA_URL}/.extraheader",
    "GIT_CONFIG_VALUE_0": "Authorization: Basic "
    + base64.b64encode(f"{GITEA_TOKEN}:".encode()).decode(),
    "GIT_CONFIG_KEY_1": "safe.directory",
    "GIT_CONFIG_VALUE_1": "*",
}

_sync_lock = threading.Lock()


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_probe = urllib.request.build_opener(_NoRedirect)


def _signed_in(status, location):
    if status in (401, 403):
        return False
    # An authenticated "/" also 302s (to the last opened folder), so only a
    # redirect aimed at /login means the caller is anonymous.
    if 300 <= status < 400:
        return urllib.parse.urlsplit(location).path.rstrip("/") != "/login"
    return status < 400


def is_authenticated(cookie):
    if not cookie:
        return False
    request = urllib.request.Request(
        CODE_SERVER_INTERNAL + "/", headers={"Cookie": cookie}
    )
    try:
        with _probe.open(request, timeout=10) as response:
            return _signed_in(response.status, response.headers.get("Location", ""))
    except urllib.error.HTTPError as error:
        return _signed_in(error.code, error.headers.get("Location", ""))
    except OSError:
        return False


def git(*args):
    subprocess.run(list(args), env=GIT_ENV, check=True, timeout=900)


def sync(owner, repo, ref):
    dest = os.path.join(WORKSPACE_ROOT, owner, repo)
    with _sync_lock:
        if os.path.isdir(os.path.join(dest, ".git")):
            git("git", "-C", dest, "fetch", "--all", "--prune")
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            git("git", "clone", f"{GITEA_URL}/{owner}/{repo}.git", dest)
        if ref:
            git("git", "-C", dest, "checkout", ref)
    return dest


class Handler(BaseHTTPRequestHandler):
    server_version = "code-server-open"
    sys_version = ""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.rstrip("/") != "/_open":
            self.fail(404, "Not found.")
            return

        params = urllib.parse.parse_qs(parsed.query)
        slug = (params.get("repo") or [""])[0]
        ref = (params.get("ref") or [""])[0]

        owner, _, repo = slug.partition("/")
        repo = repo[:-4] if repo.endswith(".git") else repo
        if not NAME_RE.match(owner) or not NAME_RE.match(repo):
            self.fail(400, "Expected repo=<owner>/<name>.")
            return
        if ref and not REF_RE.match(ref):
            self.fail(400, "Invalid ref.")
            return

        if not is_authenticated(self.headers.get("Cookie")):
            if params.get("retry"):
                self.fail(403, "Sign in to code-server first, then try again.")
                return
            # Bounce through code-server's login so the user returns here afterwards.
            back = urllib.parse.quote(
                f"/_open?repo={owner}/{repo}&retry=1", safe=""
            )
            self.redirect(f"{CODE_SERVER_URL}/login?to={back}")
            return

        try:
            dest = sync(owner, repo, ref)
        except subprocess.TimeoutExpired:
            self.fail(504, "Timed out talking to Gitea.")
            return
        except subprocess.CalledProcessError:
            self.fail(502, f"Could not fetch {owner}/{repo} from Gitea.")
            return

        self.redirect(f"{CODE_SERVER_URL}/?folder={urllib.parse.quote(dest)}")

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def fail(self, status, message):
        body = f"<h1>{status}</h1><p>{html.escape(message)}</p>".encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}")


if __name__ == "__main__":
    os.makedirs(WORKSPACE_ROOT, exist_ok=True)
    ThreadingHTTPServer(("0.0.0.0", LISTEN_PORT), Handler).serve_forever()
