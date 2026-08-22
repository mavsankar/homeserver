// github.dev style "press . to open the editor" shortcut for Gitea.
// Redirects to the code-server opener, which clones/fetches the repo first.
(function () {
  const OPENER = 'https://homecode.mavsankar.com/_open';
  const RESERVED = new Set([
    'explore', 'user', 'admin', 'api', 'assets', 'avatars', 'repo', 'org',
    'notifications', 'issues', 'pulls', 'milestones', 'graphs', 'login',
    'sign_up', 'attachments', 'devtest', 'ghost', 'v2', '-', 'swagger.v1.json',
  ]);

  document.addEventListener('keydown', function (event) {
    if (event.key !== '.' || event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target;
    if (target && (target.isContentEditable ||
        /^(input|textarea|select)$/i.test(target.tagName))) return;

    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (!match || RESERVED.has(match[1])) return;

    event.preventDefault();
    const url = new URL(OPENER);
    url.searchParams.set('repo', match[1] + '/' + match[2]);
    window.location.href = url.toString();
  });
})();
