export const schemaVersion = "0.1";
export const rulesVersion = "0.1";

export function add(...values) {
  if (!values.every(Number.isSafeInteger)) throw new Error("Se requieren enteros seguros");
  return values.reduce((total, value) => {
    const sum = total + value;
    if (!Number.isSafeInteger(sum)) throw new Error("Desbordamiento de entero seguro");
    return sum;
  }, 0);
}

export function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Fecha ISO inválida");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Fecha ISO inválida: ${value}`);
  }
  return parsed;
}

export function days(value, offset) {
  const parsed = date(value);
  parsed.setUTCDate(add(parsed.getUTCDate(), offset));
  const result = parsed.toISOString().split("T")[0];
  date(result);
  return result;
}

export const compareId = (a, b) => a.id < b.id ? -1 : Number(a.id > b.id);

export function index(items = []) {
  const result = Object.create(null);
  for (const item of items) {
    if (typeof item.id !== "string" || !/^[!-~]+$/.test(item.id) || Object.hasOwn(result, item.id)) {
      throw new Error(`ID inválido o duplicado: ${item.id}`);
    }
    result[item.id] = item;
  }
  return result;
}

export const get = (record, key) => Object.hasOwn(record, key) ? record[key] : undefined;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function compatible(actual, expected) {
  for (const key of Object.keys(expected)) {
    if (!Object.hasOwn(actual, key) ||
        JSON.stringify(canonical(actual[key])) !== JSON.stringify(canonical(expected[key]))) {
      throw new Error(`${key} incompatible: ${JSON.stringify(actual[key])}, esperado ${JSON.stringify(expected[key])}`);
    }
  }
}

export function identity(dataset) {
  compatible(dataset, { schemaVersion, rulesVersion });
  for (const key of ["datasetId", "worldRef"]) {
    if (typeof dataset[key] !== "string" || !dataset[key].trim()) throw new Error(`${key} inválido`);
  }
  return { schemaVersion, rulesVersion, datasetId: dataset.datasetId, worldRef: dataset.worldRef };
}

// Escenarios ejecutables: el escenario referencia IDs del catálogo y puede
// seleccionar observaciones sustitutas para los valores desconocidos.
export function loadScenario(dataset, scenarioId, expected = {}) {
  const version = identity(dataset);
  compatible(version, expected);
  const scenario = get(index(dataset.scenarios), scenarioId);
  if (!scenario) throw new Error(`Escenario desconocido: ${scenarioId}`);
  if (dataset.asOf !== undefined) date(dataset.asOf);
  date(scenario.startDate);
  date(scenario.endDate);
  if (scenario.endDate < scenario.startDate) throw new Error("Intervalo de escenario inválido");

  const observations = index(dataset.observations);
  const projects = index(dataset.catalog?.projects);
  const offers = index(dataset.catalog?.offers);
  function select(ids = [], catalog) {
    return ids.map(id => {
      const item = get(catalog, id);
      if (!item) throw new Error(`Referencia desconocida: ${id}`);
      return item;
    });
  }
  const nodes = (dataset.networks?.nodes ?? []).map(node => {
    const resolved = { ...node };
    for (const field of ["capacity", "protectedDemand", "priorCommitments"]) {
      const ref = node[field + "Ref"];
      if (ref !== undefined) {
        const selected = get(scenario.observationOverrides ?? {}, ref) ?? ref;
        const observation = get(observations, selected);
        if (!observation) throw new Error(`Observación desconocida: ${selected}`);
        resolved[field] = observation.value;
      }
      resolved[field] ??= null;
      if (resolved[field] !== null) nonnegative(resolved[field]);
    }
    return resolved;
  });
  const loaded = {
    ...scenario, version, nodes, edges: dataset.networks?.edges ?? [],
    actors: select(scenario.actors, index(dataset.authorities)),
    projects: select(scenario.projects, projects), offers: select(scenario.offers, offers),
  };
  for (const field of ["nodes", "edges", "funds", "projects", "offers", "events", "agreements", "sites", "goals"]) {
    loaded[field] ??= [];
    index(loaded[field]);
  }
  for (const edge of loaded.edges) nonnegative(edge.minutes);
  for (const fund of loaded.funds) nonnegative(fund.balance);
  for (const offer of loaded.offers) {
    date(offer.date);
    index(offer.candidates);
  }
  for (const event of loaded.events) {
    date(event.date);
    nonnegative(event.sequence);
  }
  for (const obligation of loaded.obligations ?? []) {
    date(obligation.startDate);
    nonnegative(obligation.amount);
    if (nonnegative(obligation.reserved ?? 0) > obligation.amount) {
      throw new Error("Reserva de mantenimiento superior a la obligación");
    }
  }
  return structuredClone(loaded);
}

export function nonnegative(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Se requiere un entero seguro no negativo");
  return value;
}
