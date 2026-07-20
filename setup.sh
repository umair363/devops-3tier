chmod 600 key.pem
ssh -i key.pem -o StrictHostKeyChecking=no ubuntu@10.0.2.153 "sudo bash -c 'cat > /etc/systemd/system/fastapi.service <<EOF
[Unit]
Description=FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/backend
EnvironmentFile=/home/ubuntu/backend/.env
ExecStart=/home/ubuntu/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
echo DATABASE_URL=postgresql://admin:admin123@10.0.2.18/threetierdb > /home/ubuntu/backend/.env
systemctl daemon-reload
systemctl enable fastapi
systemctl start fastapi
systemctl status fastapi --no-pager'"