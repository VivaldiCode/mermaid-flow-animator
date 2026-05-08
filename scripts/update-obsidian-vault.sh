#!/usr/bin/env bash
#
# update-obsidian-vault.sh
#
# Atualiza o plugin MermaidFlow Animator no seu vault local com a release mais
# recente do GitHub. Idempotente — se já estiver na versão alvo, não faz nada
# (a menos que --force seja passado).
#
# Uso:
#   ./scripts/update-obsidian-vault.sh --vault ~/MeuVault
#   OBSIDIAN_VAULT=~/MeuVault ./scripts/update-obsidian-vault.sh
#   ./scripts/update-obsidian-vault.sh --vault ~/MeuVault --version 0.1.0 --force
#
# Requer: bash, curl. Sem dependências de Node/npm.

set -euo pipefail

# --- Constantes do plugin -----------------------------------------------------
REPO="VivaldiCode/mermaid-flow-animator-obsidian"
PLUGIN_ID="mermaid-flow-animator"
ASSETS=("main.js" "manifest.json" "styles.css")

# --- Defaults / argumentos ----------------------------------------------------
VAULT="${OBSIDIAN_VAULT:-}"
TARGET_VERSION=""
FORCE=0
QUIET=0

# --- Helpers ------------------------------------------------------------------
SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Atualiza o plugin MermaidFlow Animator no seu Obsidian vault.

Uso:
  $SCRIPT_NAME --vault PATH [opções]

Opções:
  --vault PATH        Caminho do vault (ou export OBSIDIAN_VAULT=...)
  --version VERSION   Instala uma versão específica (ex: 0.1.0). Default = latest.
  --force             Reinstala mesmo se já estiver na versão alvo.
  --quiet             Silencia mensagens de progresso (mantém erros).
  --help, -h          Mostra esta ajuda.

Variáveis de ambiente:
  OBSIDIAN_VAULT      Equivalente a --vault. Útil pra colocar em .zshrc/.bashrc.

Exemplos:
  $SCRIPT_NAME --vault ~/Documents/MeuVault
  OBSIDIAN_VAULT=~/MeuVault $SCRIPT_NAME
  $SCRIPT_NAME --vault ~/MeuVault --version 0.1.0 --force
EOF
}

log() {
  if [[ $QUIET -eq 0 ]]; then
    printf '%s\n' "$*"
  fi
}

err() {
  printf '✕ %s\n' "$*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Comando obrigatório não encontrado no PATH: $1"
    exit 127
  fi
}

# --- Parsing dos argumentos ---------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault)
      [[ $# -ge 2 ]] || { err "--vault requer um valor"; exit 1; }
      VAULT="$2"; shift 2 ;;
    --version)
      [[ $# -ge 2 ]] || { err "--version requer um valor"; exit 1; }
      TARGET_VERSION="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --quiet) QUIET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Argumento desconhecido: $1"; usage; exit 1 ;;
  esac
done

# --- Pré-checks ---------------------------------------------------------------
require_cmd curl

if [[ -z "$VAULT" ]]; then
  err "Vault não informado. Use --vault PATH ou exporte OBSIDIAN_VAULT."
  usage
  exit 1
fi

# Expande ~/ caso tenha sido passado literal
VAULT="${VAULT/#\~/$HOME}"

if [[ ! -d "$VAULT" ]]; then
  err "Caminho do vault não existe: $VAULT"
  exit 1
fi

if [[ ! -d "$VAULT/.obsidian" ]]; then
  err "Não parece um vault do Obsidian (faltando .obsidian/): $VAULT"
  exit 1
fi

PLUGIN_DIR="$VAULT/.obsidian/plugins/$PLUGIN_ID"

# --- Resolve versão alvo ------------------------------------------------------
if [[ -z "$TARGET_VERSION" ]]; then
  log "→ Buscando última release de $REPO..."
  api_response=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null) || {
    err "Falha ao consultar a GitHub API. Sem internet ou rate-limited?"
    exit 1
  }
  TARGET_VERSION=$(printf '%s' "$api_response" \
    | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

  if [[ -z "$TARGET_VERSION" ]]; then
    err "Não consegui extrair a tag do JSON da API (campo tag_name vazio)."
    exit 1
  fi
  log "  Última release: $TARGET_VERSION"
fi

# --- Checa versão instalada ---------------------------------------------------
INSTALLED_VERSION=""
if [[ -f "$PLUGIN_DIR/manifest.json" ]]; then
  INSTALLED_VERSION=$(sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' \
    "$PLUGIN_DIR/manifest.json" | head -n1)
fi

if [[ -n "$INSTALLED_VERSION" \
   && "$INSTALLED_VERSION" == "$TARGET_VERSION" \
   && $FORCE -eq 0 ]]; then
  log "✓ Já está na versão $TARGET_VERSION. Use --force para reinstalar."
  exit 0
fi

if [[ -n "$INSTALLED_VERSION" ]]; then
  log "→ Atualizando: $INSTALLED_VERSION → $TARGET_VERSION"
else
  log "→ Instalando: $TARGET_VERSION (fresh)"
fi

# --- Download para um tmp e move atômico depois -------------------------------
mkdir -p "$PLUGIN_DIR"

TMP="$(mktemp -d -t mermaid-flow-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

BASE_URL="https://github.com/$REPO/releases/download/$TARGET_VERSION"

for asset in "${ASSETS[@]}"; do
  url="$BASE_URL/$asset"
  log "  ↓ $asset"
  if ! curl -fsSL --retry 2 "$url" -o "$TMP/$asset"; then
    err "Falha ao baixar $url"
    exit 1
  fi
  if [[ ! -s "$TMP/$asset" ]]; then
    err "Arquivo $asset chegou vazio. Abortando."
    exit 1
  fi
done

# Tudo baixado com sucesso — move pra pasta final
for asset in "${ASSETS[@]}"; do
  mv -f "$TMP/$asset" "$PLUGIN_DIR/$asset"
done

# --- Resumo final -------------------------------------------------------------
log ""
log "✓ MermaidFlow Animator $TARGET_VERSION instalado em:"
log "  $PLUGIN_DIR"
log ""
log "Próximo passo:"
log "  No Obsidian aperte Cmd+R (ou Ctrl+R) para reload da janela,"
log "  ou desabilite/reabilite o plugin em Settings → Community plugins."
