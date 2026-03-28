const routes = {};
let notFoundHandler = null;
let _container = null;
let _renderNav  = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function notFound(handler) {
  notFoundHandler = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';
  for (const pattern of Object.keys(routes)) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const match = path.match(new RegExp(`^${regexStr}$`));
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      return { handler: routes[pattern], params };
    }
  }
  return null;
}

export function rerender() {
  if (!_container || !_renderNav) return;
  _renderNav();
  const hash   = window.location.hash || '#/';
  const result = matchRoute(hash);
  if (result) {
    result.handler(_container, result.params);
  } else if (notFoundHandler) {
    notFoundHandler(_container);
  }
}

export function startRouter(container, renderNav) {
  _container  = container;
  _renderNav  = renderNav;

  function handleRoute() {
    renderNav();
    window.scrollTo(0, 0);
    const hash   = window.location.hash || '#/';
    const result = matchRoute(hash);
    if (result) {
      result.handler(container, result.params);
    } else if (notFoundHandler) {
      notFoundHandler(container);
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
