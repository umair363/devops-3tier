# The Ultimate Guide: AWS 3-Tier Architecture

This is the exact click-by-click, command-by-command tutorial of how we built an enterprise-grade 3-Tier architecture (React, FastAPI, PostgreSQL) from scratch.

---

## Phase 1: Networking & VPC Setup (AWS Console)
We need an isolated network to put our servers in.

1. **Create the VPC:**
   - Go to AWS Console > **VPC** > **Your VPCs**.
   - Click **Create VPC** (VPC only).
   - Name tag: `3tier-vpc`.
   - IPv4 CIDR block: `10.0.0.0/16`.
   - Click **Create VPC**.

2. **Create the Subnets:**
   - Go to **Subnets** > **Create subnet**.
   - Select `3tier-vpc`.
   - Subnet 1 Name: `public-frontend-subnet` | AZ: `us-east-1a` | CIDR: `10.0.1.0/24`.
   - Click **Add new subnet**.
   - Subnet 2 Name: `private-backend-subnet` | AZ: `us-east-1a` | CIDR: `10.0.2.0/24`.
   - Click **Create subnet**.

3. **Provide Internet Access (Internet Gateway):**
   - Go to **Internet Gateways** > **Create internet gateway**.
   - Name tag: `3tier-igw`. Click Create.
   - Click **Actions** > **Attach to VPC** > select `3tier-vpc` > Attach.

4. **Configure Route Tables:**
   - Go to **Route Tables**.
   - Select the default route table, rename it to `public-route-table`.
   - Click the **Routes** tab > **Edit routes** > **Add route**.
   - Destination: `0.0.0.0/0` | Target: Internet Gateway (`3tier-igw`) > Save.
   - Click **Subnet associations** > Edit > Check `public-frontend-subnet` > Save.
   - Click **Create route table**.
   - Name: `private-route-table` | VPC: `3tier-vpc`. Create.
   - Click **Subnet associations** > Edit > Check `private-backend-subnet` > Save.

---

## Phase 2: Security Groups (Firewalls)
We must ensure each tier only talks to what it is allowed to.

1. **Frontend Security Group:**
   - Go to **EC2** > **Security Groups** > **Create security group**.
   - Name: `frontend-sg` | VPC: `3tier-vpc`.
   - Inbound Rules:
     - Type: HTTP | Source: Anywhere-IPv4 (`0.0.0.0/0`)
     - Type: SSH | Source: Anywhere-IPv4 (`0.0.0.0/0`)
   - Click Create.

2. **Backend Security Group:**
   - Create security group. Name: `backend-sg` | VPC: `3tier-vpc`.
   - Inbound Rules:
     - Type: SSH | Source: Custom -> Select `frontend-sg`.
     - Type: Custom TCP | Port: `8000` | Source: Custom -> Select `frontend-sg`.
   - Click Create.

3. **Database Security Group:**
   - Create security group. Name: `database-sg` | VPC: `3tier-vpc`.
   - Inbound Rules:
     - Type: SSH | Source: Custom -> Select `frontend-sg`.
     - Type: PostgreSQL (5432) | Source: Custom -> Select `backend-sg`.
   - Click Create.

---

## Phase 3: Launching EC2 Instances
1. **Frontend EC2:**
   - Go to **EC2** > **Instances** > **Launch instances**.
   - Name: `Frontend-EC2`.
   - OS: Ubuntu 24.04 LTS.
   - Key pair: Create a new key pair named `3tier-key.pem` and download it.
   - Network settings: Click Edit. VPC: `3tier-vpc`. Subnet: `public-frontend-subnet`. Auto-assign Public IP: **Enable**.
   - Firewall: Select existing -> `frontend-sg`. Launch.

2. **Backend EC2:**
   - Name: `Backend-EC2`. OS: Ubuntu. Key: `3tier-key`.
   - Network: `3tier-vpc`. Subnet: `private-backend-subnet`. Auto-assign Public IP: **Disable**.
   - Firewall: `backend-sg`. Launch.

3. **Database EC2:**
   - Name: `Database-EC2`. OS: Ubuntu. Key: `3tier-key`.
   - Network: `3tier-vpc`. Subnet: `private-backend-subnet`. Auto-assign Public IP: **Disable**.
   - Firewall: `database-sg`. Launch.

4. **Elastic IP for Frontend:**
   - Go to **Elastic IPs** > **Allocate**.
   - Select the new IP > **Actions** > **Associate**. Choose `Frontend-EC2`.

---

## Phase 4: SSH Jump & The NAT Gateway Problem
Because the DB is private, we must SSH into the Frontend first, then jump to the DB.

1. **Connect to Frontend:**
   - Open Windows PowerShell.
   - `ssh -i C:\path\to\3tier-key.pem ubuntu@<FRONTEND_ELASTIC_IP>`

2. **Move Key & Jump to Database:**
   - `nano 3tier-key.pem` -> Paste the contents of your key from Windows -> Save (`Ctrl+X`, `Y`, `Enter`).
   - `chmod 400 3tier-key.pem`
   - `ssh -i 3tier-key.pem ubuntu@<DATABASE_PRIVATE_IP>`

3. **The Problem:** We ran `sudo apt update` and it froze completely.
   - *Why?* The Database EC2 is in a private subnet and cannot reach the internet to download packages.
   - *The Fix (NAT Gateway):* 
     - Go to AWS Console > **VPC** > **NAT Gateways** > Create NAT gateway.
     - Name: `3tier-nat` | Subnet: `public-frontend-subnet` | Click **Allocate Elastic IP** | Create.
     - Go to **Route Tables** > Select `private-route-table` > **Routes** > Edit > Add route: `0.0.0.0/0` targeting the NAT Gateway. Save.
   - Back in the terminal, we pressed `Ctrl+C` and ran `sudo apt update` again. It worked instantly!

---

## Phase 5: Database Setup
While SSH'd into the Database-EC2:
1. `sudo apt install postgresql -y`
2. `sudo -u postgres psql`
3. Enter SQL commands:
   ```sql
   CREATE DATABASE threetierdb;
   CREATE USER admin WITH ENCRYPTED PASSWORD 'admin123';
   GRANT ALL PRIVILEGES ON DATABASE threetierdb TO admin;
   \q
   ```
4. Open Network Config: `sudo nano /etc/postgresql/16/main/postgresql.conf`
   - Find `#listen_addresses = 'localhost'` and change it to `listen_addresses = '*'`
5. Open Auth Config: `sudo nano /etc/postgresql/16/main/pg_hba.conf`
   - Add this line at the bottom: `host all all 10.0.2.0/24 md5`
6. `sudo systemctl restart postgresql`
7. Type `exit` to return to the Frontend EC2.

---

## Phase 6: Backend Setup
From the Frontend EC2, jump to the Backend EC2:
1. `ssh -i 3tier-key.pem ubuntu@<BACKEND_PRIVATE_IP>`
2. `sudo apt update && sudo apt install python3-venv python3-pip -y`
3. `mkdir backend && cd backend`
4. `python3 -m venv venv`
5. `source venv/bin/activate`
6. Create files:
   - `nano requirements.txt` -> Paste dependencies.
   - `nano main.py` -> Paste FastAPI code.
7. `pip install -r requirements.txt`
8. Connect to DB and Start:
   - `export DATABASE_URL="postgresql://admin:admin123@<DATABASE_PRIVATE_IP>/threetierdb"`
   - `nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &`
9. Type `exit` to return to Frontend EC2.

---

## Phase 7: Frontend & Nginx Setup
We are back on the Frontend EC2.
1. `sudo apt update && sudo apt install nodejs npm nginx -y`
2. **The Problem:** `npm create vite@latest` failed due to an incompatible Node.js v18 syntax error.
   - *The Fix:* We bypassed this by forcing an older, stable version of Vite.
3. `npm create vite@5 frontend -- --template react`
4. `cd frontend && npm install`
5. Create React files:
   - `nano src/App.jsx` -> Paste React code. (Ensured `const API_URL = "";` for Nginx relative routing).
   - `nano src/App.css` -> Paste CSS code.
6. `npm run build`
7. Move files to public folder: `sudo cp -r dist/* /var/www/html/`

8. **Nginx Reverse Proxy:**
   - `sudo nano /etc/nginx/sites-available/default`
   - Delete everything and paste:
     ```nginx
     server {
         listen 80 default_server;
         root /var/www/html;
         index index.html;
         location / { try_files $uri $uri/ /index.html; }
         location /insert { proxy_pass http://<BACKEND_PRIVATE_IP>:8000/insert; }
         location /records { proxy_pass http://<BACKEND_PRIVATE_IP>:8000/records; }
     }
     ```
   - `sudo systemctl restart nginx`

9. **The Problem:** The website gave an `ERR_TIMED_OUT` error in Chrome.
   - *The Fix:* We discovered Chrome was automatically forcing `https://`. By explicitly typing `http://<ELASTIC_IP>`, and ensuring our `frontend-sg` allowed Port 80, the site successfully loaded.

---

## Phase 8: Load Balancer (ALB) & HTTPS
To make it professional, we added a Load Balancer and a real domain name (`dev.settlemint.online`).

1. **Create Subnet 2 (ALB Requirement):**
   - ALBs strictly require 2 subnets.
   - Go to **VPC > Subnets > Create Subnet**. VPC: `3tier-vpc`, Name: `public-subnet-2`, AZ: `us-east-1b` (different from first one), CIDR: `10.0.3.0/24`.
   - Go to **Route Tables**, edit `public-route-table` Subnet Associations, and check `public-subnet-2`.

2. **Create Target Group:**
   - **The Problem:** When creating the Target Group, `Frontend-EC2` said "0 instances available."
   - *The Fix:* The dropdown was set to the AWS Default VPC. We changed the dropdown to `3tier-vpc`, and the instance appeared!
   - Created `frontend-tg` (Instances, Port 80, `3tier-vpc`) and registered the `Frontend-EC2`.

3. **Create Application Load Balancer:**
   - Go to **EC2 > Load Balancers** > Create ALB. Name: `3tier-alb`. Internet-facing.
   - Selected `3tier-vpc` and checked BOTH public subnets.
   - Created a new Security Group (`alb-sg`) allowing Port 80 & 443 from Anywhere.
   - Listener: HTTP (80) forwarding to `frontend-tg`. Click Create.

4. **SSL Certificate (AWS & Namecheap):**
   - Go to **AWS Certificate Manager (ACM)**. Request public cert for `dev.settlemint.online` using DNS validation.
   - **The Problem:** The user's Namecheap DNS had an old `A Record` for the `dev` subdomain.
   - *The Fix:* Deleted the `A Record` in Namecheap.
   - Added the AWS Validation CNAME in Namecheap (Host: `_random...dev`, Value: `_random...acm-validations.aws.`).
   - Added the Routing CNAME in Namecheap (Host: `dev`, Value: `<ALB_DNS_NAME>`).
   - Waited 10 minutes until ACM showed "Issued".

5. **Finalizing HTTPS:**
   - Go to the `3tier-alb`. Under **Listeners and routing**, click **Add listener**.
   - Protocol: HTTPS (443). Forward to `frontend-tg`.
   - Selected the newly issued ACM certificate. Click Add.

**Result:** A fully secure, HTTPS-enabled, professionally routed 3-Tier Architecture!

---

## Phase 9: Automated CI/CD Pipeline (GitHub Actions)
After manually setting up the architecture, we wanted to automate deployments so that any push to the `main` branch would immediately update the servers. However, deploying a 3-tier architecture introduced significant challenges, forcing us to change our initial approach.

### 1. The Private Subnet Deployment Challenge
**The Problem:** The Backend EC2 is in a private subnet, meaning GitHub Actions cannot connect to it directly to deploy code.
**The Fix:** We used the Public Frontend EC2 as a **Jump Host (Bastion)**. 
In our `.github/workflows/deploy.yml`, we utilized the `appleboy/scp-action` and `ssh-action` plugins, configuring the `proxy_host` parameter to tunnel through the Frontend EC2:
- **Host:** `<BACKEND_PRIVATE_IP>`
- **Proxy_Host:** `<FRONTEND_PUBLIC_IP>`

### 2. The SSH Hanging & Process Termination Issue
**The Problem:** Originally in Phase 6, we ran the backend using `nohup uvicorn main:app --host 0.0.0.0 --port 8000 &`. When we tried to script this via GitHub Actions SSH, the pipeline would either freeze indefinitely (waiting for the process to exit) or, if we forced it to disconnect, the FastAPI server would immediately die because the SSH session tearing down sent a `SIGTERM` signal to all child processes.
**The Fix:** We abandoned `nohup` and upgraded to a proper Linux **systemd** service.

We created a service file on the Backend EC2 (`/etc/systemd/system/fastapi.service`):
```ini
[Unit]
Description=FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/backend
EnvironmentFile=/home/ubuntu/backend/.env
ExecStart=/home/ubuntu/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
Then, inside the GitHub Actions pipeline, we replaced the startup command with `sudo systemctl restart fastapi --no-block`. The `--no-block` flag was crucial; it tells the system to restart the service in the background and immediately return control to the SSH session, allowing the GitHub Action to complete successfully without killing the server.

### 3. Secure Secrets Management
Instead of hardcoding the `DATABASE_URL` in the server, the GitHub Action securely injects it during deployment:
```bash
echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" > /home/ubuntu/backend/.env
```
The `systemd` service then reads this `.env` file upon startup.

### 4. Zero-Downtime Frontend Deployment
For the React frontend, the pipeline installs `npm` dependencies and runs the build process *inside the GitHub Runner*, rather than on our EC2 instance. It then securely SCPs only the lightweight `dist/` folder to the Public EC2 and moves it to `/var/www/html/` before restarting Nginx. This drastically reduces the CPU load on our Frontend EC2 during deployments.

**Final Result:** A fully automated, zero-touch CI/CD pipeline that builds, tunnels through private networks, securely injects secrets, and manages persistent processes gracefully!
