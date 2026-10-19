// ===== Passo 3: banco na nuvem (Supabase) + login =====
// A tela atualiza na hora; o envio ao banco acontece em seguida.
// O localStorage vira só um cache, para a agenda abrir rápido.

const CACHE = 'agenda.cache';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);   // chaves vêm do config.js
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ----- Cache local -----
function carregar() {
  try { return JSON.parse(localStorage.getItem(CACHE)) || []; } catch { return []; }
}
function salvar() {
  try { localStorage.setItem(CACHE, JSON.stringify(eventos)); } catch { /* cache é opcional */ }
}

// ----- Banco (Supabase) -----
// Busca tudo do banco e atualiza a tela
async function atualizar() {
  const { data, error } = await db.from('eventos').select('*').order('data').order('hora');
  if (error) { avisar('Sem conexão: mostrando os dados salvos no aparelho.'); return; }
  eventos = data;
  salvar();
  desenhar();
}
// Executa uma gravação; se falhar, avisa e volta ao que está no banco
async function enviar(operacao) {
  try {
    const { error } = await operacao();
    if (error) throw error;
  } catch {
    avisar('Não foi possível salvar. Verifique a conexão.');
    atualizar();
  }
}

// ----- Estado -----
const hoje = new Date();
let eventos = carregar();       // começa pelo cache; cada item: {id, titulo, data, hora, aviso, cor, nota}
let mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let diaSelecionado = paraISO(hoje);
let editandoId = null;          // null = criando um novo

// ----- Utilitários -----
const $ = (id) => document.getElementById(id);

function paraISO(d) {           // "2026-10-18"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function deISO(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
function novoId() {              // uuid v4 (formato que o banco espera)
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,
    (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}
function el(tag, classe, texto) {   // textContent: o texto digitado nunca vira HTML
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
const doDia = (iso) => eventos.filter((e) => e.data === iso).sort((a, b) => a.hora.localeCompare(b.hora));
const textoAviso = (n) => (n === 0 ? 'sem aviso' : `aviso ${n} min antes`);

// ----- Calendário -----
function desenharCalendario() {
  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth();
  $('titulo-mes').textContent = `${MESES[mes]} / ${ano}`;
  const grade = $('grade');
  grade.replaceChildren();
  for (let i = 0; i < new Date(ano, mes, 1).getDay(); i++) grade.append(el('div'));

  for (let dia = 1; dia <= new Date(ano, mes + 1, 0).getDate(); dia++) {
    const iso = paraISO(new Date(ano, mes, dia));
    const lista = doDia(iso);
    const b = el('button', 'dia');
    b.type = 'button';
    if (iso === paraISO(hoje)) b.classList.add('hoje');
    if (iso === diaSelecionado) b.classList.add('selecionado');
    b.setAttribute('aria-pressed', iso === diaSelecionado);
    b.setAttribute('aria-label', `Dia ${dia}, ${lista.length} compromissos`);
    b.append(el('span', '', String(dia).padStart(2, '0')));
    const pontos = el('span', 'pontos');
    lista.slice(0, 4).forEach((ev) => {
      const p = el('span', 'ponto');
      p.style.setProperty('--cor', `var(--${ev.cor})`);
      pontos.append(p);
    });
    b.append(pontos);
    b.addEventListener('click', () => {
      diaSelecionado = iso;
      desenhar();
      // No celular, rola até a lista do dia
      if (window.matchMedia('(max-width: 899px)').matches) {
        const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('painel-dia').scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' });
      }
    });
    grade.append(b);
  }
}

// ----- Lista do dia -----
function desenharDia() {
  $('dia-titulo').textContent = deISO(diaSelecionado)
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  const lista = doDia(diaSelecionado);
  $('dia-contagem').textContent = `${lista.length} agendados`;
  const caixa = $('lista');
  caixa.replaceChildren();
  if (!lista.length) {
    caixa.append(el('p', 'vazio', 'Nenhum compromisso neste dia. Toque em “+ novo” para agendar.'));
    return;
  }
  lista.forEach((ev) => {
    const item = el('div', 'item');
    item.style.setProperty('--cor', `var(--${ev.cor})`);

    const editar = el('button', 'editar');       // tocar no compromisso abre a edição
    editar.type = 'button';
    editar.append(el('span', 'nome', ev.titulo));
    if (ev.nota) editar.append(el('span', 'detalhe', ev.nota));
    editar.append(el('span', 'detalhe', textoAviso(ev.aviso)));
    editar.setAttribute('aria-label', `Editar ${ev.titulo}, ${ev.hora}`);
    editar.addEventListener('click', () => abrirForm(ev));

    const remover = el('button', 'remover', 'desagendar');
    remover.type = 'button';
    remover.addEventListener('click', () => desagendar(ev.id));

    item.append(el('div', 'hora', ev.hora), el('div', 'barra'), editar, remover);
    caixa.append(item);
  });
}

// ----- Status -----
function desenharStatus() {
  const ul = $('status');
  ul.replaceChildren();
  const add = (t, cor) => { const li = el('li', '', t); li.style.setProperty('--cor', `var(--${cor})`); ul.append(li); };
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  add(`notificações: ${{ granted: 'ativas', denied: 'bloqueadas', default: 'não ativadas', unsupported: 'sem suporte' }[perm]}`,
      perm === 'granted' ? 'verde' : 'ambar');
  const deHoje = doDia(paraISO(hoje));
  add(`${deHoje.length} hoje`, 'azul');
  const agora = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;
  const prox = deHoje.find((e) => e.hora > agora);
  add(prox ? `próximo às ${prox.hora}` : 'nada mais hoje', 'ambar');
}

function desenhar() { desenharCalendario(); desenharDia(); desenharStatus(); }

// ----- Formulário -----
const dlg = $('dlg');

function abrirForm(ev) {
  editandoId = ev ? ev.id : null;
  $('dlg-titulo').textContent = ev ? 'Editar compromisso' : 'Novo compromisso';
  $('f-titulo').value = ev ? ev.titulo : '';
  $('f-data').value = ev ? ev.data : diaSelecionado;
  $('f-hora').value = ev ? ev.hora : '09:00';
  $('f-aviso').value = String(ev ? ev.aviso : 10);
  $('f-nota').value = ev ? ev.nota : '';
  document.querySelector(`input[name=cor][value=${ev ? ev.cor : 'azul'}]`).checked = true;
  $('f-excluir').hidden = !ev;          // "Desagendar" só aparece ao editar
  dlg.showModal();
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const dados = {
    titulo: $('f-titulo').value.trim(),
    data: $('f-data').value,
    hora: $('f-hora').value,
    aviso: Number($('f-aviso').value),
    cor: document.querySelector('input[name=cor]:checked').value,
    nota: $('f-nota').value.trim(),
  };
  if (!dados.titulo) { $('f-titulo').focus(); return; }
  let ev;
  if (editandoId) { ev = eventos.find((x) => x.id === editandoId); Object.assign(ev, dados); }
  else { ev = { id: novoId(), ...dados }; eventos.push(ev); }
  salvar();                                           // cache local
  enviar(() => db.from('eventos').upsert(ev));        // cria ou atualiza no banco
  diaSelecionado = dados.data;                         // mostra o dia salvo
  const d = deISO(dados.data);
  mesAtual = new Date(d.getFullYear(), d.getMonth(), 1);
  dlg.close();
  desenhar();
});

$('f-cancelar').addEventListener('click', () => dlg.close());
$('f-excluir').addEventListener('click', () => { dlg.close(); desagendar(editandoId); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // toque fora fecha

// ----- Desagendar (com opção de desfazer) -----
function desagendar(id) {
  const i = eventos.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [removido] = eventos.splice(i, 1);
  salvar();
  desenhar();
  enviar(() => db.from('eventos').delete().eq('id', id));
  avisar('Compromisso desagendado.', 'Desfazer', () => {
    eventos.push(removido); salvar(); desenhar();
    enviar(() => db.from('eventos').upsert(removido));
  });
}

// ----- Aviso rápido -----
let tempoAviso;
function avisar(texto, rotulo, acao) {
  const t = $('toast');
  t.replaceChildren(el('span', '', texto));
  if (acao) {
    const b = el('button', '', rotulo);
    b.type = 'button';
    b.addEventListener('click', () => { acao(); t.hidden = true; });
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => { t.hidden = true; }, 6000);
}

// ----- Botões do topo -----
$('btn-novo').addEventListener('click', () => abrirForm(null));
$('btn-novo-topo').addEventListener('click', () => abrirForm(null));
$('btn-ant').addEventListener('click', () => { mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1); desenhar(); });
$('btn-prox').addEventListener('click', () => { mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1); desenhar(); });
$('btn-hoje').addEventListener('click', () => {
  mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  diaSelecionado = paraISO(hoje);
  desenhar();
});

// ----- Login e sessão -----
// logado = true mostra a agenda; false mostra a tela de login
function mostrar(logado) {
  $('login').hidden = logado;
  $('app').hidden = !logado;
  $('btn-novo').hidden = !logado;
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-erro').textContent = '';
  const { error } = await db.auth.signInWithPassword({ email: $('l-email').value.trim(), password: $('l-senha').value });
  if (error) { $('login-erro').textContent = 'E-mail ou senha incorretos.'; return; }
  $('l-senha').value = '';
  eventos = carregar();
  mostrar(true);
  desenhar();
  atualizar();
});

$('btn-sair').addEventListener('click', () => db.auth.signOut());

// Ao sair (ou se a sessão expirar), limpa o cache do aparelho e volta ao login
db.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') { localStorage.removeItem(CACHE); eventos = []; mostrar(false); }
});

// Início: se já existe sessão salva, abre direto a agenda
(async () => {
  const { data } = await db.auth.getSession();
  mostrar(!!data.session);
  if (data.session) { desenhar(); atualizar(); }
})();
