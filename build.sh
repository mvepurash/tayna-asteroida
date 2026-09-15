#!/usr/bin/env bash
# ============================================================
# Сборка дистрибутива «Тайна Астероида»
#
#   ./build.sh            — собрать всё
#   ./build.sh yandex     — только архив для Яндекс Игр
#   ./build.sh web        — только папка для обычного хостинга
#
# Результат кладётся в dist/
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

OUT="dist"
STAGE="$OUT/game"
TARGET="${1:-all}"

echo "==> Очистка $OUT/"
rm -rf "$OUT"
mkdir -p "$STAGE"

echo "==> Копирование игровых файлов"
cp index.html "$STAGE/"
cp -r js "$STAGE/"
cp -r assets "$STAGE/"
# PWA-файлы (установка на домашний экран)
cp manifest.json "$STAGE/"
cp sw.js "$STAGE/"

# Что в дистрибутив НЕ попадает:
#   _unused/              — архив неиспользуемых файлов
#   *.md                  — документация (ТЗ, требования)
#   build.sh, dist/, .git — служебное
# (они просто не копируются выше)

echo "==> Проверка синтаксиса JS"
for f in "$STAGE"/js/*.js; do
  node --check "$f" > /dev/null || { echo "ОШИБКА СИНТАКСИСА: $f"; exit 1; }
done

echo "==> Проверка: не осталось ли режима калибровки"
if grep -q "FLASH_DURATION = 2" "$STAGE/js/ui_manager.js"; then
  echo "ВНИМАНИЕ: включён режим калибровки (FLASH_DURATION=2)! Верните 0.16 перед релизом."
  exit 1
fi

echo "==> Проверка: подключён ли Yandex SDK"
grep -q "yandex.ru/games/sdk" "$STAGE/index.html" \
  && echo "    SDK подключён" \
  || echo "    ВНИМАНИЕ: тег Yandex SDK не найден в index.html"

SIZE_KB=$(du -sk "$STAGE" | cut -f1)
SIZE_MB=$(echo "scale=1; $SIZE_KB/1024" | bc)
echo "==> Размер сборки: ${SIZE_MB} МБ (лимит Яндекс Игр — 100 МБ на архив, рекомендуется <10 МБ)"

if [ "$TARGET" = "yandex" ] || [ "$TARGET" = "all" ]; then
  echo "==> Архив для Яндекс Игр"
  # ВАЖНО: index.html должен лежать в КОРНЕ архива, а не во вложенной папке
  ( cd "$STAGE" && zip -qr "../tayna-asteroida-yandex.zip" . -x '*.DS_Store' )
  Z=$(du -h "$OUT/tayna-asteroida-yandex.zip" | cut -f1)
  echo "    Готово: $OUT/tayna-asteroida-yandex.zip ($Z)"
fi

if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  echo "==> Папка для обычного хостинга: $STAGE/"
  echo "    Залить содержимое на любой HTTPS-хостинг"
fi

echo
echo "==> ГОТОВО"
ls -la "$OUT"
