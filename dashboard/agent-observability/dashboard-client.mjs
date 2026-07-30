const svgNs = 'http://www.w3.org/2000/svg';
const statuses = new Set(['queued', 'working', 'completed', 'failed', 'blocked']);

export function agentKey(runId, agentId) { return `${String(runId ?? '')}\u0000${String(agentId ?? '')}`; }
export function safeTraceUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

if (typeof document !== 'undefined') {
  const byId = (id) => document.getElementById(id);
  const text = (value) => String(value ?? '?');
  const status = (value) => statuses.has(value) ? value : 'queued';
  const cell = (row, value, className = '') => {
    const element = document.createElement('td');
    element.textContent = text(value);
    if (className) element.className = className;
    row.append(element);
    return element;
  };
  const replaceRows = (rows, target, renderer) => {
    const fragment = document.createDocumentFragment();
    for (const row of rows) fragment.append(renderer(row));
    target.replaceChildren(fragment);
  };
  function dashboard(data) {
    const workspace = data.workspace ?? {};
    const project = data.project ?? {};
    const render = (target, value, detail, good) => {
      const node = byId(target);
      const headline = document.createElement('span');
      headline.className = good ? 'ok' : 'bad';
      headline.textContent = text(value);
      const extra = document.createElement('small');
      extra.textContent = text(detail);
      node.replaceChildren(headline, document.createElement('br'), extra);
    };
    render('workspace', workspace.status ?? workspace.contract ?? 'unknown', workspace.runtimeBaseline ?? workspace.ctx ?? workspace.error, workspace.contract === 'AGENTS.md present');
    render('project', project.status ?? 'unknown', project.stage ?? project.readiness ?? project.ctx ?? project.error, project.status !== 'unavailable');
  }
  function graph(agents) {
    const points = new Map(agents.map((agent, index) => [agentKey(agent.runId, agent.agentId), { x: 90 + (index % 3) * 220, y: 70 + Math.floor(index / 3) * 115 }]));
    const fragment = document.createDocumentFragment();
    for (const agent of agents) {
      const parent = agent.parentAgentId && points.get(agentKey(agent.runId, agent.parentAgentId));
      const point = points.get(agentKey(agent.runId, agent.agentId));
      if (!parent || !point) continue;
      const edge = document.createElementNS(svgNs, 'line');
      edge.setAttribute('class', 'edge'); edge.setAttribute('x1', parent.x); edge.setAttribute('y1', parent.y); edge.setAttribute('x2', point.x); edge.setAttribute('y2', point.y);
      fragment.append(edge);
    }
    for (const agent of agents) {
      const point = points.get(agentKey(agent.runId, agent.agentId));
      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('class', 'node'); circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', '31');
      const label = document.createElementNS(svgNs, 'text');
      label.setAttribute('class', 'label'); label.setAttribute('x', point.x); label.setAttribute('y', point.y - 3); label.setAttribute('text-anchor', 'middle'); label.textContent = `${text(agent.runId)}:${text(agent.agentId)}`;
      const state = document.createElementNS(svgNs, 'text');
      state.setAttribute('class', 'label'); state.setAttribute('x', point.x); state.setAttribute('y', point.y + 14); state.setAttribute('text-anchor', 'middle'); state.textContent = status(agent.status);
      fragment.append(circle, label, state);
    }
    byId('graph').replaceChildren(fragment);
  }
  function draw(data) {
    const snapshot = data.snapshot ?? { agents: [], matrix: [], tokens: {} };
    const agents = snapshot.agents ?? [];
    byId('events').textContent = `${snapshot.eventCount ?? 0} events`;
    byId('input').textContent = text(snapshot.tokens?.input);
    byId('output').textContent = text(snapshot.tokens?.output);
    dashboard(data.dashboard ?? {});
    replaceRows(snapshot.matrix ?? [], byId('matrix'), (entry) => {
      const row = document.createElement('tr');
      cell(row, entry.runId); cell(row, entry.agentId); cell(row, entry.input); cell(row, entry.output); cell(row, entry.total);
      return row;
    });
    replaceRows(agents, byId('agents'), (agent) => {
      const row = document.createElement('tr');
      cell(row, agent.agentId); cell(row, agent.parentAgentId); cell(row, status(agent.status), status(agent.status)); cell(row, agent.label); cell(row, agent.source);
      const trace = cell(row, '?');
      const url = safeTraceUrl(agent.metadata?.traceUrl);
      if (url) {
        const link = document.createElement('a');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'trace';
        trace.replaceChildren(link);
      }
      return row;
    });
    graph(agents);
  }
  const stream = new EventSource('/api/stream');
  stream.onopen = () => { byId('connection').textContent = 'SSE live'; };
  stream.onerror = () => { byId('connection').textContent = '??? ??'; };
  stream.addEventListener('snapshot', (event) => {
    try { draw(JSON.parse(event.data)); } catch { byId('connection').textContent = 'snapshot ??'; }
  });
}
