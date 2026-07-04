#!/bin/bash
# Rode ESTE script DENTRO do servidor, depois de: ssh root@84.247.187.155
# Copie e cole o conteudo inteiro no terminal SSH (ou: bash contabo-server-setup.sh)

set -e

PUB_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICGPugkg9/GupzKD09KbJastwTyjJUcAg0kHSMjFDdoO ruralcommerce@gmail.com'

echo "==> 1/7 Chave SSH"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
grep -qF "$PUB_KEY" ~/.ssh/authorized_keys 2>/dev/null || echo "$PUB_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo "==> 2/7 Pacotes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nano ufw fail2ban ca-certificates gnupg apt-transport-https
timedatectl set-timezone America/Sao_Paulo 2>/dev/null || true

echo "==> 3/7 UFW"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo y | ufw enable
ufw status numbered

echo "==> 4/7 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get install -y -qq docker-compose-plugin
docker --version
docker compose version

echo "==> 5/7 Swap 4GB"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | head -3

echo "==> 6/7 Fail2ban"
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> 7/7 Pasta /opt/etholys"
mkdir -p /opt/etholys
chmod 755 /opt/etholys

echo ""
echo "=== SETUP CONCLUIDO ==="
echo "Feche este SSH e teste do PC: ssh root@84.247.187.155"
echo "Depois avise no chat: bootstrap ok"
