# AWS 3-Tier Architecture: The "Why" and "What" Guide

This document serves as a companion to the main `3_tier_architecture_guide.md`. While the main guide provides the exact steps and commands, this guide explains *what* each AWS component actually is and exactly *why* we used it. This is crucial for understanding Cloud Architecture and explaining it in interviews.

---

## Phase 1: Networking & VPC Setup

### 1. VPC (Virtual Private Cloud)
*   **What it is:** A logically isolated section of the AWS Cloud. Think of it as drawing a big invisible fence around a piece of land in the cloud where you will build your application.
*   **Why we used it:** Without a VPC, your servers would just be floating randomly on the public internet. A VPC gives us a private network (`10.0.0.0/16`) where we completely control the IP addresses, security, and traffic flow.

### 2. Subnets (Public and Private)
*   **What they are:** Sub-sections or "rooms" within your VPC. 
*   **Why we used them:** We used the **Principle of Least Privilege**. We created a **Public Subnet** for the Frontend because it needs to be seen by the internet. We created a **Private Subnet** for the Backend and Database. The private subnet has no direct way in or out from the internet, making it highly secure against hackers.

### 3. Internet Gateway (IGW)
*   **What it is:** The "front door" to your VPC. 
*   **Why we used it:** By default, a VPC is entirely cut off from the outside world. We attached an IGW to our VPC so that internet traffic could flow in and out.

### 4. Route Tables
*   **What they are:** A set of rules (a map) that tells network traffic where to go.
*   **Why we used them:** We needed to tell the Public Subnet, "If a user wants the internet (`0.0.0.0/0`), point them to the Internet Gateway." We left the Private Subnet unattached to the IGW, which physically enforces its privacy.

---

## Phase 2: Security Groups (Firewalls)

*   **What they are:** Virtual firewalls acting as security guards at the door of each specific server (EC2 instance).
*   **Why we used them:** To prevent unauthorized access.
    *   **Frontend SG:** Allows HTTP (Port 80) and HTTPS (Port 443) so anyone on the web can see the React website.
    *   **Backend SG:** *Does not allow the internet.* It only allows traffic (Port 8000) that comes specifically from the Frontend Security Group.
    *   **Database SG:** *Does not allow the internet.* It only allows PostgreSQL traffic (Port 5432) coming specifically from the Backend Security Group. This ensures nobody can brute-force your database from the outside.

---

## Phase 3: Launching EC2 Instances

### 1. EC2 (Elastic Compute Cloud)
*   **What they are:** Virtual servers in the cloud. Think of them as renting standard Linux computers.
*   **Why we used them:** To physically host our code. We separated them (Frontend, Backend, DB) so if the Frontend crashes, the DB is perfectly fine. This is what makes a "3-Tier" architecture highly reliable.

### 2. Elastic IP (EIP)
*   **What it is:** A static, unchangeable public IP address.
*   **Why we used it:** Standard AWS public IPs change every time you restart an EC2 instance. If our IP changed, our domain name (`dev.settlemint.online`) would break. An Elastic IP guarantees the Frontend EC2 always stays at the exact same address.

---

## Phase 4: SSH Jump & The NAT Gateway Problem

### 1. SSH Jump (Bastion Host)
*   **What it is:** Using one server as a stepping stone to reach another.
*   **Why we used it:** Because our DB and Backend EC2s are in a Private Subnet, we physically cannot SSH into them from our local laptops. We had to SSH into the Public Frontend EC2 first, and then SSH from there into the Private EC2s.

### 2. NAT Gateway (Network Address Translation)
*   **What it is:** A one-way internet router. It allows private servers to download things from the internet, but blocks the internet from initiating a connection inwards.
*   **Why we used it:** When we tried to run `sudo apt update` on the Private Database server, it froze because it had no internet. We put a NAT Gateway in the *Public Subnet* and routed the Private Subnet's internet requests to it. This allowed our DB to download PostgreSQL while remaining safely hidden from inbound hackers.

---

## Phase 5: Database Setup

### 1. PostgreSQL configurations (`listen_addresses` & `pg_hba.conf`)
*   **What they are:** Configuration files that control who can talk to the database.
*   **Why we used them:** By default, Postgres only listens to itself (`localhost`). We had to change `listen_addresses = '*'` to allow it to listen to network requests. We updated `pg_hba.conf` to specifically allow incoming password connections from our Backend's IP range (`10.0.2.0/24`).

---

## Phase 6: Backend Setup (FastAPI & Systemd)

### 1. Systemd Service
*   **What it is:** The built-in Linux system manager that runs background processes (daemons).
*   **Why we used it:** Initially, running the backend manually would stop if the terminal closed. A `systemd` service ensures that if the server reboots, or if the process crashes, Linux will automatically restart the FastAPI backend in the background.

---

## Phase 7: Frontend & Nginx Setup

### 1. Nginx Reverse Proxy
*   **What it is:** A high-performance web server that sits in front of your applications. 
*   **Why we used it:** 
    1. It hosts the static HTML/CSS/JS React files exceptionally fast.
    2. **Reverse Proxy:** When the React app asks for `/insert` data, Nginx intercepts that request and seamlessly forwards it backward to the hidden FastAPI Backend on Port 8000. The user's browser never knows the backend exists.

---

## Phase 8: Load Balancer (ALB) & HTTPS

### 1. Application Load Balancer (ALB)
*   **What it is:** A smart traffic cop that distributes incoming website traffic.
*   **Why we used it:** Even though we only have one Frontend EC2 right now, an ALB is an enterprise standard. If we add 5 more Frontend servers later, the ALB evenly distributes users among them. It also acts as the central point for managing secure connections.

### 2. AWS Certificate Manager (ACM) & HTTPS
*   **What it is:** ACM provides free SSL/TLS certificates (the padlock icon in your browser).
*   **Why we used it:** Regular HTTP sends data in plain text (easily stolen). HTTPS encrypts the data. We attached the ACM certificate directly to the Load Balancer, meaning the ALB handles all the complex encryption math, offloading that work from our EC2 servers.

---

## Phase 9: Automated CI/CD (GitHub Actions)

### 1. CI/CD Pipeline
*   **What it is:** Continuous Integration / Continuous Deployment. It’s an automated robot script.
*   **Why we used it:** Without it, every code change requires manually logging into servers, stopping processes, copying files, and restarting. The pipeline automates this, preventing human error and allowing developers to deploy updates in seconds simply by pushing to GitHub.

### 2. Secrets Management
*   **What it is:** Storing sensitive data (like `DATABASE_URL` with passwords) safely.
*   **Why we used it:** Hardcoding passwords in code uploaded to GitHub is a massive security flaw. By injecting secrets via the CI/CD pipeline at runtime, our codebase remains clean and hackers cannot steal our database credentials from our repository.
