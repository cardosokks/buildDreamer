#!/bin/sh
set -e

echo ""
echo "========================================================"
echo "🚀 BUILD DREAMER - FRONTEND INICIADO COM SUCESSO!"
echo "========================================================"
echo "🌐 Porta interna do contêiner Nginx: 80"
echo "📡 Roteamento de API: /api -> http://backend:5000"
echo ""
echo "📋 CONFIGURAÇÃO NO EASYPANEL:"
echo "   1. Acesse o Easypanel no seu projeto."
echo "   2. No serviço 'frontend' (ou 'app'), vá na aba 'Domains'."
echo "   3. Certifique-se de que a 'Port' configurada no domínio seja: 80"
echo "   4. Seu acesso será diretamente pelo domínio configurado:"
echo "      👉 https://seu-dominio.nip.io ou seu domínio customizado."
echo "========================================================"
echo ""

exec nginx -g "daemon off;"
