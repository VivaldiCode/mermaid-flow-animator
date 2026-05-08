# MermaidFlow Animator — Obsidian Plugin

Renderiza flowcharts Mermaid como diagramas **animados** dentro do Obsidian. Partículas verdes (sucesso) e vermelhas (erro) percorrem canos visualizando os caminhos do fluxo, ajudando a explicar processos, requisições, máquinas de estado e qualquer pipeline que tenha decisões.

> Companion da web app: [mermaid-flow-animator.pages.dev](https://mermaid-flow-animator.pages.dev/)

---

## Como usar

Em qualquer nota, use um bloco de código com a linguagem `mermaid-flow`:

````markdown
```mermaid-flow
flowchart TD
    A([Start]) --> B[Enter Credentials]
    B --> C{Valid?}
    C -->|Yes| D[Load Dashboard]
    C -->|No| E[Show Error]
    E --> B
    D --> F([End])
```
````

O bloco vira um diagrama interativo:

- Layout automático via dagre
- Arestas em estilo cano (4 camadas com glow)
- Auto-spawn de partículas a cada ~2s nos nós iniciais
- Tipo alternado a cada spawn (sucesso, erro, sucesso…)
- Em IFs subsequentes, a partícula sorteia 50/50 — explora ambos os ramos ao longo do tempo
- Loops detectados via revisita por nó (limite 3 visitas)
- **Clique em qualquer nó** para disparar uma partícula manual a partir dali

### Configuração via comentários `%%`

Customize o comportamento da animação adicionando **comentários `%%` no topo do bloco**. São idiomáticos do Mermaid (não quebram o parse) e aceitam pares `chave: valor` ou `chave=valor`:

````markdown
```mermaid-flow
%% type: success
%% speed: 2
%% interval: 1000
%% spawn: 2
flowchart TD
    A([Start]) --> B[Process]
    B --> C{OK?}
    C -->|Yes| D[Done]
    C -->|No| E[Error]
```
````

| Chave | Valores aceitos | Default | O que faz |
|---|---|---|---|
| `type` | `success` &#124; `error` &#124; `alternate` | `alternate` | Que tipo de partícula spawnar nos nós iniciais. `success` (verde) só sucesso, `error` (vermelho) só erro, `alternate` intercala. |
| `speed` | `0.1` – `10` (aceita sufixo `x`) | `1` | Multiplicador de velocidade. `1` = 1 aresta por segundo. `2` ou `2x` = duas vezes mais rápido. `0.5` = câmera lenta. |
| `interval` | `200` – `10000` (ms) | `2200` | Tempo entre spawns automáticos nos nós iniciais. Menor = mais partículas no canvas. |
| `spawn` | `1` – `10` | `1` | Quantas partículas dispara em cada batch (a cada `interval` ms). |
| `controls` | `true` &#124; `false` &#124; `show` &#124; `hide` | `true` | Mostra/esconde o botão de play/pause no canto superior direito. Útil para gravar GIFs limpos. |

Exemplos práticos:

```mermaid-flow
%% Só sucessos, rápido, dois por vez
%% type: success
%% speed: 2x
%% interval: 800
%% spawn: 2
```

```mermaid-flow
%% Modo "estresse" — 3 partículas a cada 500ms
%% interval: 500
%% spawn: 3
```

```mermaid-flow
%% Demo limpo para gravar (sem controles, devagar)
%% controls: hide
%% speed: 0.5
%% interval: 4000
```

### Botão Play / Pause

No canto superior direito de cada diagrama aparece um botão `⏸` (pause) / `▸` (play). Click pausa **toda** a animação — partículas congelam onde estão, novos spawns ficam suspensos. Clicar de novo retoma sem saltos (o `dt` é resetado pra evitar avanços bruscos).

Útil para:
- Examinar o estado num momento específico do fluxo
- Capturar screenshots
- Pausar enquanto explica para alguém

Para esconder o botão (ex: gravando GIF da nota), use `%% controls: hide` no bloco.

### Sintaxe Mermaid suportada

| Elemento | Sintaxe |
|---|---|
| Direção | `flowchart TD` (TB / BT / LR / RL) |
| Retângulo | `A[Label]` |
| Estádio | `A([Label])` |
| Diamante (decisão) | `A{Label}` |
| Círculo | `A((Label))` |
| Subrotina | `A[[Label]]` |
| Aresta | `A --> B` |
| Aresta com label | `A -->|Yes| B` |
| Aresta encadeada | `A --> B --> C` |
| Comentário | `%% texto` (linha própria) |

**Não suportado** (ainda): subgraphs, classes/styles, links externos, gráficos não-flowchart (sequence, gantt, pie, etc.).

---

## Instalação

### Via Community Plugins (após aprovação)

1. Configurações → Community plugins → Browse
2. Pesquise por **MermaidFlow Animator**
3. Install → Enable

### Manual (BRAT ou cópia direta)

Para testar antes da aprovação:

1. Em qualquer release deste repositório, baixe os 3 arquivos:
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. Coloque em `<vault>/.obsidian/plugins/mermaid-flow-animator/`
3. Reabra o Obsidian e ative o plugin em Configurações → Community plugins

Alternativa: use o [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) e adicione este repositório como beta.

---

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Build watch (recompila a cada mudança)
npm run dev

# Build de produção (minificado)
npm run build

# Type check
npm run typecheck
```

### Iterar dentro do Obsidian

```bash
# Symlink da pasta para o vault
ln -s "$(pwd)" "<vault>/.obsidian/plugins/mermaid-flow-animator"

# Watch + auto-rebuild
npm run dev

# No Obsidian: Cmd+R para reload após mudanças (ou use o plugin "Hot Reload")
```

### Bumping versão

```bash
# Atualiza package.json + manifest.json + versions.json + cria commit
npm version patch    # 0.1.0 → 0.1.1
npm version minor    # 0.1.0 → 0.2.0
npm version major    # 0.1.0 → 1.0.0

# Push tag para disparar a release automática
git push origin main --tags
```

A action [`.github/workflows/release.yml`](.github/workflows/release.yml) builda e publica os artefatos (`main.js`, `manifest.json`, `styles.css`) automaticamente como assets do GitHub Release.

---

## Arquitetura

```
plugin/
├── manifest.json          ← metadata Obsidian
├── versions.json          ← mapping version → minAppVersion
├── package.json           ← deps próprias do plugin (sem React/Vite)
├── tsconfig.json
├── esbuild.config.mjs     ← bundle CommonJS
├── version-bump.mjs       ← hook de npm version
├── main.ts                ← Plugin entry; registra processador "mermaid-flow"
├── renderer.ts            ← FlowAnimator (extends MarkdownRenderChild)
├── styles.css             ← estilos aplicados a `.mermaid-flow-*`
├── shared/                ← utilities core (sincronizadas com a web app)
│   ├── types/graph.ts
│   └── utils/
│       ├── mermaidParser.ts
│       ├── applyDagreLayout.ts
│       ├── colorScheme.ts
│       ├── particleFactory.ts
│       └── pathCalculator.ts
├── .github/workflows/
│   └── release.yml        ← auto release on tag push
├── LICENSE                ← MIT
└── README.md              ← este arquivo
```

`FlowAnimator` herda de `MarkdownRenderChild` (lifecycle do Obsidian):

1. **`onload()`** — parseia source com regex linha-a-linha → aplica `applyDagreLayout` (dagre puro) → monta o `<svg>` estático com defs (markers de seta + filtro de glow), edges (4 camadas de cano), nodes (5 shapes) e particles-layer → inicia rAF loop e timer de auto-spawn.
2. **`advanceParticles(dt)`** — para cada partícula: avança progress proporcional a `dt`, calcula posição via `path.getPointAtLength()`, gerencia trail de 6 pontos. Quando completa uma aresta, decide o `kind` da próxima (mantém kind, inverte se loop, ou randomiza após o primeiro IF) e spawna nova partícula via `pickEdgeForKind` do core.
3. **`renderParticles()`** — limpa e re-cria os círculos SVG (trail + halo + core + highlight) a cada frame.
4. **`onunload()`** — cancela rAF + interval, limpa refs. Obsidian chama isso ao trocar de nota / desabilitar o plugin.

Sem React, sem virtual DOM. ~103 KB minificado (dagre é ~80 KB).

---

## Submissão à Obsidian Community Plugins

Para o mantenedor — caminho oficial de aprovação:

1. **Crie um repositório dedicado no GitHub** — esse plugin vive em [VivaldiCode/mermaid-flow-animator-obsidian](https://github.com/VivaldiCode/mermaid-flow-animator-obsidian).
2. **Extraia** a pasta `plugin/` para a raiz desse repo via git subtree:
   ```bash
   # A partir do mermaid-Visualizer (web app)
   git subtree split --prefix plugin -b plugin-only
   git push https://github.com/VivaldiCode/mermaid-flow-animator-obsidian.git plugin-only:main
   ```
3. **Faça push da primeira release** com tag `0.1.0` — a action automática vai gerar os assets:
   ```bash
   git tag 0.1.0
   git push --tags
   ```
4. **Verifique** que o release tem `main.js`, `manifest.json` e `styles.css` como assets binários
5. **Abra um PR** em [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) adicionando uma entrada ao final de [`community-plugins.json`](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json):
   ```json
   {
     "id": "mermaid-flow-animator",
     "name": "MermaidFlow Animator",
     "author": "VivaldiCode",
     "description": "Render Mermaid flowcharts as live, animated diagrams — particles flow through pipe-styled edges to visualize success/error paths.",
     "repo": "VivaldiCode/mermaid-flow-animator-obsidian"
   }
   ```
6. **Aguarde a review** dos mantenedores oficiais (geralmente 1-4 semanas). Eles vão checar:
   - O plugin atende às [diretrizes para devs](https://docs.obsidian.md/Developer+policies)
   - Não usa APIs privadas
   - Tem `manifest.json` válido com `id` único
   - Funciona conforme descrito
7. **Após merge**, o plugin aparece automaticamente na aba Community plugins do Obsidian de qualquer usuário

Documentação oficial: [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).

---

## Sincronização com a web app

Os arquivos em `shared/` são **cópias** dos correspondentes em `../src/` da web app. Se você atualizar a parser/layout/cores na web app, copie para cá:

```bash
cp ../src/types/graph.ts shared/types/graph.ts
cp ../src/utils/{mermaidParser,applyDagreLayout,colorScheme,particleFactory,pathCalculator}.ts shared/utils/
```

A duplicação é proposital — quando o plugin for extraído para repo próprio, ele continua funcionando sem dependência da web app.

---

## Licença

MIT — veja [LICENSE](LICENSE).
