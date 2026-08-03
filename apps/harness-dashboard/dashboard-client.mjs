const projects = document.querySelector('#projects'); const runs = document.querySelector('#runs'); const sources = document.querySelector('#sources'); const freshness = document.querySelector('#freshness');
const cell = (text) => { const element = document.createElement('td'); element.textContent = String(text ?? 'not reported'); return element; };
const table = (headers) => { const element = document.createElement('table'); const header = document.createElement('tr'); headers.forEach((text) => { const item = document.createElement('th'); item.textContent = text; header.append(item); }); element.append(header); return element; };
const artifacts = (project) => (project.statusArtifacts ?? []).map((item) => `${item.path}: ${item.available ? item.modifiedAt : 'not reported'}`).join('\n');
function render(data) {
  freshness.textContent = `updated ${new Date(data.generatedAt).toLocaleTimeString()}`;
  const projectTable = table(['Project', 'Tooling', 'Manifest / provenance', 'Status artifacts', 'Scoped Git']);
  for (const project of data.projects ?? []) { const row = document.createElement('tr'); row.append(cell(project.id), cell(project.tooling), cell(project.manifest ?? project.provenance), cell(artifacts(project)), cell(project.git ? `${project.git.dirty ? 'dirty' : 'clean'} ? ${project.git.latestCommitAt ?? 'no commit'}` : 'not reported')); projectTable.append(row); }
  if (!(data.projects ?? []).length) { const empty = document.createElement('p'); empty.textContent = 'No project directories found under work/.'; projects.replaceChildren(empty); } else projects.replaceChildren(projectTable);
  const runTable = table(['Run', 'Stage', 'Freshness', 'Worktree', 'Claims', 'Verification', 'Git']);
  for (const run of data.runs) { const row = document.createElement('tr'); row.append(cell(run.id), cell(run.stage), cell(run.updatedAt), cell(run.worktree), cell((run.claims ?? []).join(', ')), cell((run.verifications ?? []).map((item) => `${item.command}: ${item.exitCode}`).join(', ')), cell(run.git ? `${run.git.head}${run.git.dirty ? ' dirty' : ' clean'}` : 'not reported')); runTable.append(row); }
  if (!data.runs.length) { const empty = document.createElement('p'); empty.textContent = 'No active harness runs. Discovered work projects remain visible above.'; runs.replaceChildren(empty); } else runs.replaceChildren(runTable);
  const list = document.createElement('ul'); for (const source of data.sources) { const item = document.createElement('li'); item.textContent = `${source.path}: ${source.exists ? source.modifiedAt : 'not reported'}`; list.append(item); } sources.replaceChildren(list);
}
const stream = new EventSource('/api/stream'); stream.addEventListener('snapshot', (event) => render(JSON.parse(event.data))); stream.onerror = () => { freshness.textContent = 'connection interrupted; retrying'; };
