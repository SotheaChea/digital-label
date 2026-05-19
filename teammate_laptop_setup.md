# 💻 Digital Label: Teammate's Laptop Setup Guide

Follow this guide step-by-step to get the exact same Ubuntu, Nginx, PHP 8.4, MySQL, and Domain Mapping environment running on your laptop.

---

### Step 1: Install Ubuntu 24.04 on Windows
1. Press the **Windows Key** on your keyboard, type **`cmd`**, right-click **Command Prompt**, and select **"Run as Administrator"**.
2. Run these two commands to enable the virtualization features:
   ```cmd
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```
   ```cmd
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   ```
3. **Restart your laptop.**
4. Once logged back in, open **Command Prompt (CMD) as Administrator** again and run:
   ```cmd
   wsl --install -d Ubuntu-24.04
   ```
5. A new window will pop up to install Ubuntu. 
   * **Username:** Enter `kitzu` (or your name).
   * **Password:** Enter a simple password (e.g., `password123`). *Note: When typing the password, the screen will stay blank. Type blindly and press Enter.*

---

### Step 2: Stop XAMPP on Windows
Before configuring Ubuntu, open your **XAMPP Control Panel** on Windows and click **Stop** next to both **Apache** and **MySQL**. This is required so port 80 is free for Ubuntu!

---

### Step 3: Install PHP 8.4, Nginx & MySQL in Ubuntu
Open your new **Ubuntu terminal** and run these commands one by one:

#### 1. Update the packages:
```bash
sudo apt update && sudo apt upgrade -y
```
*(Enter your Ubuntu password blindly when prompted).*

#### 2. Install the PHP 8.4 repository:
```bash
sudo add-apt-repository ppa:ondrej/php -y && sudo apt update
```

#### 3. Install PHP 8.4, Nginx, and MySQL:
```bash
sudo apt install -y php8.4-fpm php8.4-mysql php8.4-xml php8.4-curl php8.4-gd php8.4-mbstring php8.4-zip php8.4-bcmath nginx mysql-server certbot python3-certbot-nginx
```

---

### Step 4: Configure the MySQL Database
Inside your **Ubuntu terminal**:

1. Log into MySQL:
   ```bash
   sudo mysql
   ```
2. Paste these commands **one by one** to create the database, user, and grant privileges:
   ```sql
   CREATE DATABASE digital_label CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
   ```sql
   CREATE USER 'laravel_user'@'localhost' IDENTIFIED BY 'password123';
   ```
   ```sql
   GRANT ALL PRIVILEGES ON digital_label.* TO 'laravel_user'@'localhost';
   ```
   ```sql
   FLUSH PRIVILEGES;
   ```
   ```sql
   EXIT;
   ```

---

### Step 5: Mount your Windows Code Folder
Inside your **Ubuntu terminal**, you need to link your Windows folder. Since she might have cloned the project in a different folder on her laptop, she must change the path accordingly.

#### 💡 How to map any Windows folder in Ubuntu:
* Drive **`C:\`** is mapped to **`/mnt/c/`**
* Drive **`D:\`** is mapped to **`/mnt/d/`**
* Change all backslashes **`\`** to forward slashes **`/`**.
* *Example:* If her folder is at `C:\Users\laptop\Digital-Label`, her Ubuntu path will be `"/mnt/c/Users/laptop/Digital-Label"`.

Run these commands in the **Ubuntu terminal** (make sure to replace `"/mnt/d/Project/..."` with **her** custom path if it's different!):

#### 1. Link the folder:
```bash
sudo ln -sf "/mnt/d/Project/All backend Project/Digital-Label" /var/www/digital-label
```

#### 2. Apply safe storage permissions:
```bash
sudo chmod -R 777 "/mnt/d/Project/All backend Project/Digital-Label/backend/storage"
```
```bash
sudo chmod -R 777 "/mnt/d/Project/All backend Project/Digital-Label/backend/bootstrap/cache"
```

---

### Step 6: Configure Nginx Virtual Host
Inside your **Ubuntu terminal**, run this command to copy our server configuration directly:

```bash
sudo tee /etc/nginx/sites-available/digital-label.conf << 'EOF'
server {
    listen 80;
    server_name digital.label;
    root /var/www/digital-label/backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF
```

#### Activate Nginx config:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/digital-label.conf /etc/nginx/sites-enabled/
sudo mkdir -p /run && sudo touch /run/nginx.pid
sudo service nginx restart
sudo service php8.4-fpm restart
```

---

### Step 7: Laravel Environment Setup
Inside your **Ubuntu terminal**, run the database migrations and seeders:
```bash
cd /var/www/digital-label/backend
php artisan migrate:fresh --seed
```

---

### Step 8: Domain Mapping on Windows
1. Switch back to your **Windows Command Prompt (opened as Administrator)**.
2. Run this command to map the local domain:
   ```cmd
   echo 127.0.0.1 digital.label >> C:\Windows\System32\drivers\etc\hosts
   ```

---

### Step 9: Sharing Custom Database Rows (Optional)
If you created new custom products or labels on the website UI and want your teammate to have the exact same custom items:

#### A. How YOU export your database (Ubuntu terminal):
Run this command to save your current database to a file in your project folder:
```bash
mysqldump -u laravel_user -p digital_label > /var/www/digital-label/database_backup.sql
```
*(Enter `password123` when prompted. Commit and push this file to GitHub).*

#### B. How SHE imports your database (Ubuntu terminal):
After pulling the update from GitHub, she can run this command to load your custom database:
```bash
mysql -u laravel_user -p digital_label < /var/www/digital-label/database_backup.sql
```
*(Enter `password123` when prompted. She will instantly have all your custom products and rows).*

---

### 🎉 All Done!
Open your browser and visit: **`http://digital.label`** to see your live Ubuntu server in action!
