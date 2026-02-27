#!/bin/bash
set -e

echo "=== Duck Hunt - Kurulum ==="

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    echo "Node.js bulunamadı. Kuruluyor (nvm ile)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
else
    echo "Node.js: $(node -v)"
fi

# Bağımlılıkları yükle
echo "Bağımlılıklar yükleniyor..."
npm install

echo ""
echo "=== Kurulum tamamlandı! ==="
echo ""
echo "Çalıştırmak için:"
echo "  node server/index.js"
echo ""
echo "Docker ile:"
echo "  docker-compose up -d"
echo ""
