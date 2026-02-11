# ЦАХИМ ТӨЛБӨРИЙН БАРИМТЫН СИСТЕМ - POS API 3.0

## 📋 Төслийн Тойм

**POS API 3.0** нь Монгол Улсын Татварын Ерөнхий Газрын **ST-Ebarimt** системтэй холбогдон ажилладаг цахим төлбөрийн баримтын (е-баримт) API модуль юм.

| Үзүүлэлт | Утга |
|----------|------|
| **Хувилбар** | 1.0.1 |
| **Технологи** | Node.js + TypeScript + Express.js |
| **Өгөгдлийн сан** | PostgreSQL |
| **Порт** | 4001 |
| **API Base URL** | `http://localhost:4001/posapi` |

---

## 🏗️ Системийн Архитектур

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (ERP System)                          │
│                    https://erp.itsystem.mn, https://cdn.itsystem.mn         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTP REST API
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POS API 3.0 (Express.js)                            │
│                              Port: 4001                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Routes    │  │  Wrapper    │  │   Client    │  │     Helpers         │ │
│  │  /posapi/*  │──│ PosApiWrapper│──│ HTTP Client │  │ bill-processor.ts   │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  │ tax.ts, barcode.ts  │ │
│                                           │         │ payment.ts          │ │
│                                           │         └─────────────────────┘ │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            │ HTTP REST
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ST-Ebarimt POS Bridge (localhost:7080)                   │
│                         /rest/receipt, /rest/sendData                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Татварын Ерөнхий Газар (ТЕГ)                         │
│                    https://api.ebarimt.mn (Public API)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                                  │
│                 pos_api_logs, pos_api_receipts, pos_api_settings            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Төслийн Бүтэц

```
Pos-API-module/
├── src/                              # TypeScript эх код
│   ├── server.ts                     # Үндсэн entry point, Express app
│   ├── client.ts                     # ST-Ebarimt API HTTP client
│   ├── config.ts                     # Тохиргооны удирдлага
│   ├── db.ts                         # PostgreSQL холболт & queries
│   ├── wrapper.ts                    # Баримтын үйлдлийн wrapper
│   ├── types.ts                      # TypeScript interfaces
│   ├── enums.ts                      # Enum тодорхойлолтууд
│   ├── http.ts                       # HTTP request handler
│   ├── log-types.ts                  # Log interface definitions
│   │
│   ├── routes/                       # API endpoints
│   │   ├── settings.ts               # POS тохиргооны CRUD
│   │   ├── logs.ts                   # Баримтын лог routes
│   │   └── ebarimt-info.ts           # Ebarimt API proxy routes
│   │
│   └── helpers/                      # Туслах функцууд
│       ├── index.ts                  # Export helpers
│       ├── bill-processor.ts         # Баримт боловсруулах логик
│       ├── tax.ts                    # Татвар тооцоолол
│       ├── payment.ts                # Төлбөр баталгаажуулалт
│       ├── barcode.ts                # Баркод төрөл тодорхойлох
│       └── duplicate-checker.ts      # Давхардал шалгах
│
├── dist/                             # Compiled JavaScript
├── data/                             # Өгөгдлийн хавтас
├── postman/                          # Postman collection
│
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript тохиргоо
├── .env                              # Environment variables
├── .gitignore                        # Git ignore rules
├── README.md                         # Баримт бичиг
│
├── district.json                     # Дүүргийн мэдээлэл
├── oat.json                          # OAT reference data
└── product.json                      # Бүтээгдэхүүний мэдээлэл
```

---

## 🔌 API Endpoints

### 1. Баримтын Үндсэн Үйлдлүүд

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| `POST` | `/posapi/addBill` | Шинэ баримт үүсгэх (давхардал шалгах) |
| `POST` | `/posapi/updateBill` | Баримт шинэчлэх (ebarimtId эсвэл orderId шаардлагатай) |
| `POST` | `/posapi/deleteBill` | Баримт буцаах/устгах (ebarimtId шаардлагатай) |
| `POST` | `/posapi/sendBills` | Хүлээгдэж буй баримтуудыг ST-Ebarimt руу илгээх |
| `GET` | `/posapi/receipt/:orderId` | Захиалгын ID-аар баримт авах |

### 2. Тохиргооны Endpoints

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| `GET` | `/posapi/settings` | Бүх POS тохиргоог авах |
| `POST` | `/posapi/settings` | POS тохиргоо үүсгэх/upsert |
| `PUT` | `/posapi/settings` | POS тохиргоо шинэчлэх |
| `DELETE` | `/posapi/settings/:merchantTin` | Merchant TIN-аар тохиргоо устгах |

### 3. Лог Endpoints

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| `GET` | `/posapi/logs` | Захиалгын лог жагсаалт (paginated) |
| `GET` | `/posapi/returns` | Буцаалтын лог жагсаалт |
| `GET` | `/posapi/updates` | Шинэчлэлтийн лог жагсаалт |
| `GET` | `/posapi/response-logs` | Хариултын лог жагсаалт |
| `GET` | `/posapi/response-logs/:orderId` | Захиалгын хариултын лог |

### 4. Ebarimt Мэдээллийн Endpoints

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| `GET` | `/posapi/info/branches` | Салбарын мэдээлэл |
| `GET` | `/posapi/info/tin-by-reg/:regNo` | Регистрийн дугаараар TIN авах |
| `GET` | `/posapi/info/tin/:tin` | TIN-аар байгууллагын мэдээлэл |
| `GET` | `/posapi/info/product-tax-codes` | Бүтээгдэхүүний татварын кодууд |
| `GET` | `/posapi/getTinInfo?regNo=XXXX` | Frontend-д зориулсан TIN хайлт |
| `GET` | `/posapi/getInfo?tin=XXXX` | Frontend-д зориулсан байгууллагын мэдээлэл |

### 5. Health Check

| Method | Endpoint | Тайлбар |
|--------|----------|---------|
| `GET` | `/health` | Серверийн төлөв шалгах |

---

## 💾 Өгөгдлийн Сангийн Бүтэц

### pos_api_logs
Баримт илгээлтийн лог (order_id + merchant_tin бүрд нэг бичлэг)

```sql
CREATE TABLE pos_api_logs (
    log_id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    id TEXT NOT NULL,                    -- POS баримтын ID
    date TIMESTAMPTZ NOT NULL,
    merchant_tin TEXT DEFAULT '',
    success BOOLEAN,
    message TEXT,
    error_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, merchant_tin)
);
```

### pos_api_receipts
Баримтын бүрэн мэдээлэл, ST-Ebarimt хариулттай хамт

```sql
CREATE TABLE pos_api_receipts (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    merchant_tin TEXT NOT NULL,
    ebarimt_id TEXT,
    total_amount DECIMAL(18,2),
    total_vat DECIMAL(18,2),
    total_city_tax DECIMAL(18,2),
    receipt_type TEXT,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    response_status TEXT,              -- SUCCESS, ERROR, PAYMENT
    response_message TEXT,
    response_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, merchant_tin)
);
```

### pos_api_return_logs
Буцаалтын лог (append-only)

```sql
CREATE TABLE pos_api_return_logs (
    log_id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    id TEXT NOT NULL,
    return_date TIMESTAMPTZ NOT NULL,
    merchant_tin TEXT DEFAULT '',
    success BOOLEAN,
    message TEXT,
    error_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### pos_api_update_logs
Баримт шинэчлэлтийн лог

```sql
CREATE TABLE pos_api_update_logs (
    log_id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL,
    old_id TEXT NOT NULL,
    new_id TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    merchant_tin TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, old_id, new_id)
);
```

### pos_api_settings
POS тохиргоо (merchant бүрд)

```sql
CREATE TABLE pos_api_settings (
    merchant_tin TEXT PRIMARY KEY,
    pos_no TEXT NOT NULL,
    district_code TEXT NOT NULL,
    branch_no TEXT NOT NULL,
    bill_id_suffix TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Баримтын Төрлүүд

### Receipt Types (Баримтын төрөл)

| Код | Тайлбар |
|-----|---------|
| `B2C_RECEIPT` | Иргэний баримт |
| `B2B_RECEIPT` | Байгууллагын баримт |
| `B2C_INVOICE` | Иргэний нэхэмжлэл |
| `B2B_INVOICE` | Байгууллагын нэхэмжлэл |

### VAT Types (НӨАТ төрөл)

| Код | Тайлбар |
|-----|---------|
| `VAT_ABLE` | НӨАТ-тай |
| `VAT_FREE` | НӨАТ-аас чөлөөлөгдсөн |
| `VAT_ZERO` | НӨАТ тэг |

### Payment Types (Төлбөрийн төрөл)

| Код | Тайлбар |
|-----|---------|
| `CASH` | Бэлэн мөнгө |
| `PAYMENT_CARD` | Картын төлбөр |
| `BANK_TRANSFER` | Банкны шилжүүлэг |
| `BONUS_CARD_TEST` | Бонус карт (тест) |
| `EMD` | E-Money |

---

## 🧮 Татварын Тооцоолол

### Татварын хувь хэмжээ

| Татварын төрөл | Хувь | Хуваагч |
|----------------|------|---------|
| НӨАТ + НХАТ | 10% + 2% | 1.12 |
| Зөвхөн НӨАТ | 10% | 1.10 |
| Зөвхөн НХАТ | 2% | 1.02 |
| Татваргүй | 0% | 1.00 |

### Татвар тооцоолох жишээ

```typescript
// totalAmount = 112,000 төгрөг (НӨАТ + НХАТ-тай)
const divisor = 1.12;
const baseAmount = totalAmount / divisor;  // 100,000
const vat = baseAmount * 0.10;             // 10,000
const cityTax = baseAmount * 0.02;         // 2,000
```

---

## 🔄 Баримт Үүсгэх Урсгал

```
1. Frontend POST /posapi/addBill
              ↓
2. Давхардал шалгах (database query)
              ↓
3. [Давхардал байвал & force=true] → inactiveId оноох
              ↓
4. processBillRequest() - Татвар тооцоох, DirectBillRequest бэлтгэх
              ↓
5. PosApiWrapper.POST_BILL()
              ↓
6. Client.postData() - HTTP POST localhost:7080/rest/receipt
              ↓
7. ST-Ebarimt хариулт: receipt ID, QR data, lottery number
              ↓
8. saveReceipt() - pos_api_receipts хүснэгтэд хадгалах
              ↓
9. Frontend-д хариулт буцаах:
   {
     status: "SUCCESS",
     id: "ebarimtId",
     qrData: "QR код",
     lottery: "Сугалааны дугаар",
     date: "Огноо (UB timezone)"
   }
```

---

## 🖥️ Ubuntu Server Дээр Байршуулах

### 1. Серверийн Шаардлага

| Үзүүлэлт | Доод шаардлага |
|----------|----------------|
| **OS** | Ubuntu 22.04 LTS |
| **CPU** | 2 vCPU |
| **RAM** | 4 GB |
| **Storage** | 20 GB SSD |
| **Node.js** | >= 18.0.0 |
| **PostgreSQL** | >= 14 |

### 2. Node.js Суулгах

```bash
# NodeSource репозитор нэмэх
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js суулгах
sudo apt-get install -y nodejs

# Хувилбар шалгах
node --version    # v20.x.x
npm --version     # 10.x.x
```

### 3. PostgreSQL Суулгах

```bash
# PostgreSQL суулгах
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# PostgreSQL эхлүүлэх
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Өгөгдлийн сан үүсгэх
sudo -u postgres psql

CREATE DATABASE posapi;
CREATE USER posapi_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE posapi TO posapi_user;
\q
```

### 4. Төсөл Байршуулах

```bash
# Төсөл хуулах
cd /opt
sudo git clone <repository_url> pos-api
cd pos-api

# Dependencies суулгах
npm install

# Build хийх
npm run build

# .env файл тохируулах
sudo nano .env
```

### 5. Environment Variables (.env)

```env
# Server тохиргоо
PORT=4001
NODE_ENV=production

# ST-Ebarimt POS Bridge
POS_API_BASE_URL=http://localhost:7080

# PostgreSQL холболт
DATABASE_URL=postgresql://posapi_user:your_secure_password@localhost:5432/posapi

# Merchant тохиргоо
MERCHANT_TIN=37900846788
POS_NO=10012476
DISTRICT_CODE=3504
BRANCH_NO=001
BILL_ID_SUFFIX=01
```

### 6. PM2 Process Manager

```bash
# PM2 суулгах
sudo npm install -g pm2

# Аппликейшн эхлүүлэх
pm2 start dist/server.js --name "pos-api"

# Автоматаар эхлүүлэх тохируулах
pm2 startup systemd
pm2 save

# Мониторинг
pm2 status
pm2 logs pos-api
pm2 monit
```

### 7. Systemd Service (PM2-ийн оронд)

```bash
sudo nano /etc/systemd/system/pos-api.service
```

```ini
[Unit]
Description=POS API 3.0 Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pos-api
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=pos-api
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Service идэвхжүүлэх
sudo systemctl daemon-reload
sudo systemctl enable pos-api
sudo systemctl start pos-api
sudo systemctl status pos-api
```

---

## 🔒 UFW Галт Хана Тохиргоо

### 1. UFW Суулгах ба Идэвхжүүлэх

```bash
# UFW суулгах
sudo apt-get install -y ufw

# UFW статус шалгах
sudo ufw status verbose
```

### 2. Үндсэн Дүрмүүд

```bash
# Бүх ирэх холболтыг хориглох (default)
sudo ufw default deny incoming

# Бүх гарах холболтыг зөвшөөрөх (default)
sudo ufw default allow outgoing

# SSH зөвшөөрөх (port 22)
sudo ufw allow ssh
# эсвэл
sudo ufw allow 22/tcp

# HTTP зөвшөөрөх (port 80)
sudo ufw allow http
# эсвэл
sudo ufw allow 80/tcp

# HTTPS зөвшөөрөх (port 443)
sudo ufw allow https
# эсвэл
sudo ufw allow 443/tcp
```

### 3. POS API Порт Тохиргоо

```bash
# POS API порт зөвшөөрөх (4001)
sudo ufw allow 4001/tcp

# Тодорхой IP-аас л зөвшөөрөх (илүү аюулгүй)
sudo ufw allow from 192.168.1.0/24 to any port 4001

# Тодорхой домэйноос зөвшөөрөх
sudo ufw allow from erp.itsystem.mn to any port 4001
```

### 4. PostgreSQL Порт Тохиргоо

```bash
# PostgreSQL port (зөвхөн localhost)
# Гаднаас холбогдох шаардлагатай бол:
sudo ufw allow from 192.168.1.0/24 to any port 5432

# Эсвэл тодорхой IP-д зөвшөөрөх
sudo ufw allow from 103.87.255.220 to any port 5432
```

### 5. ST-Ebarimt POS Bridge Порт

```bash
# POS Bridge port (7080) - зөвхөн localhost
# Гаднаас хандах шаардлагагүй
# Хэрэв шаардлагатай бол:
sudo ufw allow from 127.0.0.1 to any port 7080
```

### 6. UFW Идэвхжүүлэх

```bash
# UFW идэвхжүүлэх
sudo ufw enable

# Статус шалгах
sudo ufw status verbose

# Дүрмүүдийг дугаартай харах
sudo ufw status numbered
```

### 7. UFW Дүрмүүдийн Жишээ

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
4001/tcp                   ALLOW IN    192.168.1.0/24
5432/tcp                   ALLOW IN    103.87.255.220
22/tcp (v6)                ALLOW IN    Anywhere (v6)
80/tcp (v6)                ALLOW IN    Anywhere (v6)
443/tcp (v6)               ALLOW IN    Anywhere (v6)
```

### 8. Дүрэм Устгах

```bash
# Дугаараар устгах
sudo ufw status numbered
sudo ufw delete 5

# Дүрмээр устгах
sudo ufw delete allow 4001/tcp
```

---

## 🛡️ Нэмэлт Аюулгүй Байдлын Арга Хэмжээ

### 1. Nginx Reverse Proxy

```bash
# Nginx суулгах
sudo apt-get install -y nginx

# Тохиргоо файл үүсгэх
sudo nano /etc/nginx/sites-available/pos-api
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.mn;

    # HTTP to HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.mn;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.mn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.mn/privkey.pem;

    # SSL тохиргоо
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Site идэвхжүүлэх
sudo ln -s /etc/nginx/sites-available/pos-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Let's Encrypt SSL

```bash
# Certbot суулгах
sudo apt-get install -y certbot python3-certbot-nginx

# SSL сертификат авах
sudo certbot --nginx -d api.yourdomain.mn

# Автоматаар шинэчлэх шалгах
sudo certbot renew --dry-run
```

### 3. Fail2Ban Суулгах

```bash
# Fail2Ban суулгах
sudo apt-get install -y fail2ban

# Тохиргоо хуулах
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Тохиргоо засах
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

```bash
# Fail2Ban эхлүүлэх
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

### 4. PostgreSQL Аюулгүй Байдал

```bash
# pg_hba.conf засах
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

```
# IPv4 local connections:
host    posapi          posapi_user     127.0.0.1/32            scram-sha-256
host    posapi          posapi_user     192.168.1.0/24          scram-sha-256

# Reject all other connections
host    all             all             0.0.0.0/0               reject
```

```bash
# PostgreSQL дахин ачаалах
sudo systemctl reload postgresql
```

### 5. Log Rotation

```bash
sudo nano /etc/logrotate.d/pos-api
```

```
/var/log/pos-api/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload pos-api > /dev/null 2>&1 || true
    endscript
}
```

---

## 📈 Мониторинг ба Лог

### PM2 Мониторинг

```bash
# Статус харах
pm2 status

# Лог харах
pm2 logs pos-api

# Бодит цагийн мониторинг
pm2 monit

# Метрик харах
pm2 show pos-api
```

### Systemd Journal

```bash
# Лог харах
sudo journalctl -u pos-api -f

# Сүүлийн 100 мөр
sudo journalctl -u pos-api -n 100

# Тодорхой хугацааны лог
sudo journalctl -u pos-api --since "2024-01-01" --until "2024-01-02"
```

### Health Check Script

```bash
#!/bin/bash
# /opt/pos-api/health-check.sh

ENDPOINT="http://localhost:4001/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

if [ "$RESPONSE" != "200" ]; then
    echo "POS API is down! Status: $RESPONSE"
    # Restart service
    sudo systemctl restart pos-api
    # Send alert (optional)
    # curl -X POST "https://hooks.slack.com/..." -d '{"text":"POS API restarted"}'
fi
```

```bash
# Crontab-д нэмэх (5 минут тутам шалгах)
*/5 * * * * /opt/pos-api/health-check.sh >> /var/log/pos-api/health-check.log 2>&1
```

---

## 🔧 Тохиргооны Файлууд

### package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "rimraf dist && tsc && copy oat.json to dist/",
    "typecheck": "tsc --noEmit",
    "format": "prettier -w .",
    "lint": "eslint ."
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

---

## 🚀 Хөгжүүлэлтийн Командууд

```bash
# Хөгжүүлэлтийн горим (hot reload)
npm run dev

# Production build
npm run build

# Production эхлүүлэх
npm start

# Type шалгах
npm run typecheck

# Format хийх
npm run format

# Lint шалгах
npm run lint
```

---

## 📝 API Хүсэлтийн Жишээ

### Баримт Үүсгэх (addBill)

```bash
curl -X POST http://localhost:4001/posapi/addBill \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-2024-001",
    "merchantTin": "37900846788",
    "posNo": "10012476",
    "branchNo": "001",
    "districtCode": "3504",
    "billIdSuffix": "01",
    "type": "B2C_RECEIPT",
    "receipts": [
      {
        "items": [
          {
            "name": "Бүтээгдэхүүн 1",
            "barcode": "4901234567890",
            "code": "001",
            "taxType": "VAT_ABLE",
            "measureUnit": "ш",
            "qty": 2,
            "unitPrice": 50000,
            "totalAmount": 100000
          }
        ]
      }
    ],
    "payments": [
      {
        "code": "CASH",
        "status": "PAID",
        "paidAmount": 112000
      }
    ]
  }'
```

### Хариултын Жишээ

```json
{
  "success": true,
  "status": 1,
  "message": "Амжилттай",
  "data": {
    "id": "POS-2024-001-001",
    "qrData": "...",
    "lottery": "ABCD1234",
    "date": "2024-01-15T10:30:00+08:00",
    "totalAmount": 112000,
    "totalVAT": 10000,
    "totalCityTax": 2000
  }
}
```

---

## ⚠️ Алдааны Хариултууд

### Давхардал Алдаа

```json
{
  "success": false,
  "status": 0,
  "duplicate": true,
  "existingBill": {
    "orderId": "ORD-2024-001",
    "ebarimtId": "POS-2024-001-001",
    "date": "2024-01-15T10:30:00+08:00"
  },
  "message": "ID давхцаж байна. Хамаагүй юу?"
}
```

### Баталгаажуулалтын Алдаа

```json
{
  "success": false,
  "status": 0,
  "message": "orderId талбар заавал шаардлагатай"
}
```

---

## 📞 Холбоо Барих

| Үзүүлэлт | Утга |
|----------|------|
| **Хөгжүүлэгч** | IT System LLC |
| **Вэбсайт** | https://itsystem.mn |
| **ERP Систем** | https://erp.itsystem.mn |

---

## 📄 Лиценз

Энэ төсөл нь хувийн эзэмшлийн програм хангамж бөгөөд зөвшөөрөлгүйгээр хуулбарлах, түгээхийг хориглоно.

---

**Сүүлд шинэчлэгдсэн:** 2026-02-04
