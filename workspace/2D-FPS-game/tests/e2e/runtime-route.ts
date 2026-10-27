const TEST_ORIGIN = "https://runtime.invalid";
const ABSOLUTE_URL = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

interface RuntimeRouteOptions {
  readonly arcade?: "classic" | "cozy";
}

export function runtimeRoute(target = "/", options: RuntimeRouteOptions = {}): string {
  const route = new URL(target, TEST_ORIGIN);
  if (options.arcade !== undefined) {
    route.searchParams.set("arcade", options.arcade);
  }
  route.searchParams.set("setup", "complete");

  if (ABSOLUTE_URL.test(target)) {
    return route.toString();
  }

  return `${route.pathname}${route.search}${route.hash}`;
}
