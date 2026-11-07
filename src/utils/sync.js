// ─────────────────────────────────────────────────────────────────────────────
// sync.js — junção segura dos dados entre aparelhos (iPhone × PC × Drive).
//
// Cada conta, cartão, lançamento e categoria guarda `atualizadoEm` (ms) da última
// alteração; exclusões ficam em `removidos` ("l:123" → ms). Na junção, cada item
// fica com a versão mais recente, e a exclusão vale se for mais nova que a edição.
// Assim, editar coisas diferentes em dois aparelhos não apaga nada.
//
// `meta.geracao` muda quando TODOS os dados são substituídos (importação do
// Organizze / restaurar backup): nesse caso não se junta — vale a geração mais nova.
// ─────────────────────────────────────────────────────────────────────────────

export const COLECOES = { contas: 'c', cartoes: 'k', lancamentos: 'l', categorias: 'g' };
const DIAS_GUARDAR_EXCLUSOES = 180;

const ts = (x) => (x && typeof x.atualizadoEm === 'number' ? x.atualizadoEm : 0);

function carimbarFaturas(antes = {}, depois = {}, agora) {
  if (antes === depois) return depois;
  const out = {};
  for (const [k, v] of Object.entries(depois || {})) {
    const igual = antes && antes[k] === v;
    out[k] = igual || !v || typeof v !== 'object' ? v : { ...v, atualizadoEm: agora };
  }
  return out;
}

// Marca o que mudou entre `antes` e `depois` (mutações imutáveis: item igual = mesma referência).
export function carimbar(antes, depois, agora = Date.now()) {
  const removidos = { ...(antes?.removidos || {}), ...(depois.removidos || {}) };
  const out = { ...depois };
  let mudou = false;
  for (const [col, pref] of Object.entries(COLECOES)) {
    const lista = depois[col] || [];
    if (antes && antes[col] === lista) continue;
    const ant = new Map((antes?.[col] || []).map((x) => [String(x.id), x]));
    out[col] = lista.map((x) => {
      const a = ant.get(String(x.id));
      if (a === x) return x;
      mudou = true;
      const y = { ...x, atualizadoEm: agora };
      if (col === 'cartoes') y.faturasPagas = carimbarFaturas(a?.faturasPagas, x.faturasPagas, agora);
      return y;
    });
    const atuais = new Set(lista.map((x) => String(x.id)));
    for (const id of ant.keys()) {
      if (!atuais.has(id)) { removidos[`${pref}:${id}`] = agora; mudou = true; }
    }
  }
  out.removidos = removidos;
  out.meta = { ...(antes?.meta || {}), ...(depois.meta || {}), ...(mudou ? { atualizadoEm: agora } : {}) };
  return out;
}

// Marca uma substituição total (importação / restauração de backup)
export function novaGeracao(dados, agora = Date.now()) {
  return {
    ...dados,
    removidos: {},
    meta: { ...(dados.meta || {}), geracao: `${agora}-${Math.random().toString(36).slice(2, 8)}`, geracaoEm: agora, atualizadoEm: agora },
  };
}

function mesclarFaturas(a = {}, b = {}) {
  const out = { ...b };
  for (const [k, v] of Object.entries(a || {})) {
    if (!(k in out) || ts(v) >= ts(out[k])) out[k] = v;
  }
  return out;
}

// Dá uma identificação de origem a dados que ainda não têm (antes de enviar ao Drive).
// geracaoEm 0: qualquer importação/restauração de verdade tem prioridade sobre ela.
export function garantirGeracao(dados, agora = Date.now()) {
  if (dados?.meta?.geracao) return dados;
  return { ...dados, meta: { ...(dados?.meta || {}), geracao: `base-${agora}-${Math.random().toString(36).slice(2, 8)}`, geracaoEm: 0 } };
}

// Dados sem identificação de origem (de versões antigas do app, nunca sincronizados nesta
// versão) NÃO são juntados item a item com outro conjunto: os códigos internos podem ser
// diferentes para o mesmo lançamento e tudo ficaria duplicado. Vale o conjunto com origem
// (ou o do Drive); do outro lado só entra o que foi criado/editado nesta versão (carimbado).
function preferir(base, outro) {
  const out = { ...base };
  for (const [col, pref] of Object.entries(COLECOES)) {
    const ids = new Set((base[col] || []).map((x) => String(x.id)));
    const extras = (outro[col] || []).filter((x) => ts(x) > 0 && !ids.has(String(x.id)) &&
      !((base.removidos || {})[`${pref}:${x.id}`] >= ts(x)));
    out[col] = [...(base[col] || []), ...extras];
  }
  return out;
}

// Junta os dados deste aparelho (local) com os do Drive (remoto).
export function mesclar(local, remoto, agora = Date.now()) {
  if (!remoto) return local;
  if (!local) return remoto;

  const temOrigem = (d) => !!d.meta?.geracao;
  if (!temOrigem(local) || !temOrigem(remoto)) {
    return temOrigem(local) && !temOrigem(remoto) ? preferir(local, remoto) : preferir(remoto, local);
  }

  const gl = local.meta?.geracao ?? null;
  const gr = remoto.meta?.geracao ?? null;
  const el = local.meta?.geracaoEm ?? 0;
  const er = remoto.meta?.geracaoEm ?? 0;
  if (gl !== gr && (el > 0 || er > 0)) {
    // houve substituição total (importação/restauração) em algum aparelho: vale a mais recente, sem juntar
    return el > er ? local : remoto;
  }
  // gl !== gr com as duas "batizadas" (geracaoEm 0): mesma base que ganhou identificação em
  // aparelhos diferentes ao mesmo tempo → junta normalmente e fica com a menor (todos convergem)
  const geracaoFinal = gl < gr ? gl : gr;

  // exclusões: maior data de cada uma; descarta as muito antigas
  const limite = agora - DIAS_GUARDAR_EXCLUSOES * 86400000;
  const removidos = {};
  for (const fonte of [remoto.removidos || {}, local.removidos || {}]) {
    for (const [k, t] of Object.entries(fonte)) {
      if (t >= limite && (!(k in removidos) || t > removidos[k])) removidos[k] = t;
    }
  }

  const out = { ...remoto, ...local };
  for (const [col, pref] of Object.entries(COLECOES)) {
    const mapaLocal = new Map((local[col] || []).map((x) => [String(x.id), x]));
    const vistos = new Set();
    const lista = [];
    const decidir = (id, r, l) => {
      let item;
      if (r && l) {
        item = ts(l) >= ts(r) ? l : r; // empate: fica o deste aparelho
        if (col === 'cartoes') item = { ...item, faturasPagas: mesclarFaturas(l.faturasPagas, r.faturasPagas) };
      } else item = r || l;
      const exc = removidos[`${pref}:${id}`];
      if (exc != null && exc >= ts(item)) return;
      lista.push(item);
    };
    for (const r of remoto[col] || []) {
      const id = String(r.id);
      vistos.add(id);
      decidir(id, r, mapaLocal.get(id));
    }
    for (const l of local[col] || []) {
      const id = String(l.id);
      if (!vistos.has(id)) decidir(id, null, l);
    }
    out[col] = lista;
  }
  out.removidos = removidos;
  out.meta = {
    ...(remoto.meta || {}),
    ...(local.meta || {}),
    geracao: geracaoFinal,
    geracaoEm: Math.max(el, er),
    atualizadoEm: Math.max(local.meta?.atualizadoEm || 0, remoto.meta?.atualizadoEm || 0),
  };
  return out;
}

// Compara o conteúdo (para saber se precisa enviar ao Drive)
export function mesmoConteudo(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
