#!/usr/bin/env bash
# Установка и обновление DocDD Console на сервере Ubuntu (docs/14-deploy.md,
# adr/0018-shared-server.md). Запуск повторный: каждый шаг проверяет, что уже
# сделано. Пример:
#
#   sudo REPO_URL=https://example.com/team/docdd-console.git ./deploy/deploy.sh
#
set -Eeuo pipefail

REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/docdd-console}"
APP_USER="${APP_USER:-docdd}"
NODE_VERSION="${NODE_VERSION:-}"
APP_PORT="${APP_PORT:-3000}"
PUBLIC_PORT="${PUBLIC_PORT:-8088}"
SERVER_NAME="${SERVER_NAME:-_}"
AUTH_USER="${AUTH_USER:-docdd}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"
PROJECTS_DIR="${PROJECTS_DIR:-/srv/projects}"

APP_HOME="/var/lib/${APP_USER}"
NODE_ROOT="/opt"
SERVICE="docdd-console"
HTPASSWD_FILE="/etc/nginx/docdd.htpasswd"
NGINX_CONF="/etc/nginx/conf.d/${SERVICE}.conf"
UNIT_FILE="/etc/systemd/system/${SERVICE}.service"
POLICY_RC="/usr/sbin/policy-rc.d"

GENERATED_PASSWORD=""
NGINX_FRESH=0
POLICY_RC_OURS=0
WORK_DIR=""

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }

cleanup() {
  [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR"
  # Запрет запуска служб на время установки nginx снимаем в любом случае,
  # иначе остальные пакеты системы перестанут стартовать.
  if [ "$POLICY_RC_OURS" = 1 ]; then rm -f "$POLICY_RC"; fi
}
trap cleanup EXIT
trap 'die "сбой на строке $LINENO"' ERR

# Всё, что делает приложение, — под его пользователем, а не под root.
as_app() {
  runuser -u "$APP_USER" -- env "HOME=${APP_HOME}" \
    "PATH=${NODE_ROOT}/node/bin:/usr/local/bin:/usr/bin:/bin" "$@"
}

is_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }

port_listener() { ss -H -ltnp "sport = :$1" 2>/dev/null || true; }

preflight() {
  log "Проверка окружения"
  [ "$(id -u)" -eq 0 ] || die "запустите от root: sudo REPO_URL=… $0"
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = "ubuntu" ] || die "скрипт рассчитан на Ubuntu, а здесь ${ID:-неизвестная система}"
  [ -n "$REPO_URL" ] || die "не задан REPO_URL — откуда клонировать приложение"
  is_port "$APP_PORT" || die "APP_PORT должен быть числом от 1 до 65535"
  is_port "$PUBLIC_PORT" || die "PUBLIC_PORT должен быть числом от 1 до 65535"
  [ "$PUBLIC_PORT" != "80" ] || die "порт 80 скрипт не занимает: он нужен другим службам сервера"
  [ "$PUBLIC_PORT" != "$APP_PORT" ] || die "APP_PORT и PUBLIC_PORT должны различаться"
  [[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "APP_USER содержит недопустимые символы"
  [[ "$AUTH_USER" =~ ^[A-Za-z0-9._-]+$ ]] || die "AUTH_USER: только буквы, цифры, точка, дефис, подчёркивание"
  [[ "$SERVER_NAME" =~ ^[A-Za-z0-9._*-]+$ ]] || die "SERVER_NAME содержит недопустимые символы"

  local who
  who="$(port_listener "$PUBLIC_PORT")"
  if [ -n "$who" ] && ! grep -q nginx <<<"$who"; then
    die "порт ${PUBLIC_PORT} занят другим процессом: ${who}"
  fi
  who="$(port_listener "$APP_PORT")"
  if [ -n "$who" ] && ! systemctl is-active --quiet "$SERVICE"; then
    die "порт ${APP_PORT} занят другим процессом: ${who}"
  fi
}

install_packages() {
  log "Пакеты"
  if ! command -v nginx >/dev/null 2>&1; then
    NGINX_FRESH=1
    # nginx при установке сам стартует на порту 80, а он занят Docker: пакет
    # остался бы недонастроенным. Пока ставим — запускать службы запрещено.
    if [ ! -e "$POLICY_RC" ]; then
      printf '#!/bin/sh\nexit 101\n' >"$POLICY_RC"
      chmod +x "$POLICY_RC"
      POLICY_RC_OURS=1
    fi
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    git curl ca-certificates xz-utils openssl nginx apache2-utils
  if [ "$POLICY_RC_OURS" = 1 ]; then
    rm -f "$POLICY_RC"
    POLICY_RC_OURS=0
  fi
}

create_user() {
  log "Пользователь ${APP_USER} и каталоги"
  cd /
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "$APP_HOME" \
      --shell /usr/sbin/nologin "$APP_USER"
  fi
  mkdir -p "$APP_DIR" "$PROJECTS_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR" "$PROJECTS_DIR"
  # Приложение коммитит от имени пользователя сервиса; без имени git откажет.
  if [ -z "$(as_app git config --global user.name || true)" ]; then
    as_app git config --global user.name "DocDD Console"
    as_app git config --global user.email "${APP_USER}@$(hostname -f 2>/dev/null || hostname)"
  fi
}

sync_repo() {
  log "Исходники (ветка ${BRANCH})"
  cd /
  if [ ! -d "$APP_DIR/.git" ]; then
    [ -z "$(ls -A "$APP_DIR")" ] || die "${APP_DIR} не пуст и не является клоном репозитория"
    as_app git clone --branch "$BRANCH" -- "$REPO_URL" "$APP_DIR"
  fi
  cd "$APP_DIR"
  if [ -n "$(as_app git status --porcelain --untracked-files=no)" ]; then
    die "в ${APP_DIR} есть свои изменения: они не затираются, разберитесь с ними и запустите снова"
  fi
  as_app git fetch origin "$BRANCH"
  as_app git checkout "$BRANCH"
  as_app git merge --ff-only "origin/${BRANCH}"
}

node_arch() {
  case "$(uname -m)" in
    x86_64) echo x64 ;;
    aarch64) echo arm64 ;;
    *) die "архитектура $(uname -m) не поддерживается" ;;
  esac
}

install_node() {
  log "Node"
  local want="$NODE_VERSION"
  if [ -z "$want" ]; then
    [ -f "$APP_DIR/.nvmrc" ] || die "нет ${APP_DIR}/.nvmrc и не задан NODE_VERSION"
    want="$(tr -d '[:space:]' <"$APP_DIR/.nvmrc")"
  fi
  want="${want#v}"

  local base
  if [[ "$want" =~ ^[0-9]+$ ]]; then
    base="https://nodejs.org/dist/latest-v${want}.x"
  elif [[ "$want" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    base="https://nodejs.org/dist/v${want}"
  else
    die "версию Node '${want}' не разобрать: нужно 22 или 22.12.0"
  fi

  WORK_DIR="$(mktemp -d)"
  curl -fsSL "${base}/SHASUMS256.txt" -o "$WORK_DIR/SHASUMS256.txt"
  local arch line file hash version
  arch="$(node_arch)"
  line="$(grep -E " node-v[0-9.]+-linux-${arch}\.tar\.xz\$" "$WORK_DIR/SHASUMS256.txt" || true)"
  [ -n "$line" ] || die "в ${base} нет сборки для linux-${arch}"
  hash="${line%% *}"
  file="${line##* }"
  version="${file#node-}"
  version="${version%%-linux-*}"

  local dest="${NODE_ROOT}/node-${version}"
  if [ ! -x "$dest/bin/node" ]; then
    curl -fsSL "${base}/${file}" -o "$WORK_DIR/$file"
    (cd "$WORK_DIR" && printf '%s  %s\n' "$hash" "$file" | sha256sum -c -) \
      || die "контрольная сумма ${file} не совпала"
    tar -xJf "$WORK_DIR/$file" -C "$WORK_DIR" --no-same-owner
    mv "$WORK_DIR/${file%.tar.xz}" "$dest"
    chown -R root:root "$dest"
  fi
  ln -sfn "$dest" "${NODE_ROOT}/node"

  # Тот же диапазон, что в package.json: Nuxt и Vite иначе не стартуют.
  local major minor
  major="$("${NODE_ROOT}/node/bin/node" -p 'process.versions.node.split(".")[0]')"
  minor="$("${NODE_ROOT}/node/bin/node" -p 'process.versions.node.split(".")[1]')"
  if ! { [ "$major" -gt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 12 ]; } \
      || { [ "$major" -eq 20 ] && [ "$minor" -ge 19 ]; }; }; then
    die "Node ${version} не подходит: нужен ^20.19.0 или >=22.12.0"
  fi
  echo "Node ${version} → ${NODE_ROOT}/node"
}

build_app() {
  log "Сборка"
  cd "$APP_DIR"
  as_app npm ci --no-audit --no-fund
  as_app npm run build
  [ -f "$APP_DIR/.output/server/index.mjs" ] || die "сборка не создала .output/server/index.mjs"
}

write_if_changed() {
  # write_if_changed <путь> <права> — содержимое со stdin; возвращает 0, если файл изменился.
  local path="$1" mode="$2" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [ -f "$path" ] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    return 1
  fi
  install -m "$mode" "$tmp" "$path"
  rm -f "$tmp"
  return 0
}

install_service() {
  log "Служба ${SERVICE}"
  # Сервис слушает только 127.0.0.1: Nitro по умолчанию — все интерфейсы,
  # а наружу приложение выпускает один nginx с авторизацией (ADR-0018).
  if write_if_changed "$UNIT_FILE" 644 <<EOF; then
[Unit]
Description=DocDD Console
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=NITRO_HOST=127.0.0.1
Environment=NITRO_PORT=${APP_PORT}
Environment=DOCDD_MODE=shared
Environment=DOCDD_PROJECT_ROOTS=${PROJECTS_DIR}
Environment=PATH=${APP_HOME}/.local/bin:${NODE_ROOT}/node/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=${NODE_ROOT}/node/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
  fi
  systemctl enable "$SERVICE" >/dev/null
  systemctl restart "$SERVICE"
}

setup_auth() {
  log "Авторизация на входе"
  if [ ! -f "$HTPASSWD_FILE" ] && [ -z "$AUTH_PASSWORD" ]; then
    AUTH_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
    GENERATED_PASSWORD="$AUTH_PASSWORD"
  fi
  if [ -n "$AUTH_PASSWORD" ]; then
    # Пароль — через stdin, а не аргументом: его видно в списке процессов.
    if [ -f "$HTPASSWD_FILE" ]; then
      printf '%s' "$AUTH_PASSWORD" | htpasswd -iB "$HTPASSWD_FILE" "$AUTH_USER"
    else
      printf '%s' "$AUTH_PASSWORD" | htpasswd -iBc "$HTPASSWD_FILE" "$AUTH_USER"
    fi
  fi
  chown root:www-data "$HTPASSWD_FILE"
  chmod 640 "$HTPASSWD_FILE"
}

setup_nginx() {
  log "nginx на порту ${PUBLIC_PORT}"
  # Запись в журнале и ответ идут потоком, а запрос к модели может идти минуты:
  # без этого nginx копит ответ и обрывает долгий запрос.
  write_if_changed "$NGINX_CONF" 644 <<EOF || true
server {
    listen ${PUBLIC_PORT};
    server_name ${SERVER_NAME};

    auth_basic "DocDD Console";
    auth_basic_user_file ${HTPASSWD_FILE};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }
}
EOF
  # Стандартный сайт слушает 80, занятый Docker, и nginx бы не стартовал.
  # Отключаем его только у nginx, который поставили мы (или не смог стартовать
  # из-за него в прошлый запуск); работающий чужой nginx не трогаем.
  if [ "$NGINX_FRESH" = 1 ] || { ! systemctl is-active --quiet nginx \
      && [ -e /etc/nginx/sites-enabled/default ] && [ -n "$(port_listener 80)" ]; }; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t
  systemctl enable nginx >/dev/null
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  else
    systemctl start nginx
  fi
  if command -v ufw >/dev/null 2>&1; then
    local ufw_state
    ufw_state="$(ufw status 2>/dev/null || true)"
    if grep -q '^Status: active' <<<"$ufw_state"; then
      ufw allow "${PUBLIC_PORT}/tcp" >/dev/null
    fi
  fi
}

verify() {
  log "Проверка"
  local i code
  for i in $(seq 1 60); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}/"; then break; fi
    if [ "$i" -eq 60 ]; then
      journalctl -u "$SERVICE" -n 40 --no-pager || true
      die "сервис не ответил на 127.0.0.1:${APP_PORT} за минуту"
    fi
    sleep 1
  done
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PUBLIC_PORT}/" || true)"
  [ "$code" = "401" ] || die "nginx без пароля ответил ${code}, а ожидалось 401: авторизация не работает"
  echo "Сервис отвечает, nginx просит пароль."
}

report() {
  local host
  host="$(hostname -I 2>/dev/null | awk '{print $1}')"
  log "Готово"
  echo "Адрес:   http://${host:-<адрес сервера>}:${PUBLIC_PORT}/"
  echo "Логин:   ${AUTH_USER}"
  if [ -n "$GENERATED_PASSWORD" ]; then
    echo "Пароль:  ${GENERATED_PASSWORD}   (показан один раз, в системе хранится только хеш)"
  fi
  echo "Проекты: ${PROJECTS_DIR} — клонируйте под пользователем ${APP_USER}"
  echo "Модель:  sudo -u ${APP_USER} -H claude  (вход вручную, docs/14-deploy.md)"
}

preflight
install_packages
create_user
sync_repo
install_node
build_app
install_service
setup_auth
setup_nginx
verify
report
