# 🧾 POSAPI Module

A lightweight REST service for managing **E-Barimt POS operations**, receipt logs, and configuration data for merchants.  
This module provides both wrapper endpoints for internal system integration and direct access to the official **E-Barimt API**.

---

## 🚀 Overview

The **posapi-module** acts as a middleware between your e-commerce or POS backend and the official Mongolian E-Barimt API.  
It handles:
- Receipt creation, updates, and deletion  
- Invoice and non-invoice bill posting  
- Return and update logs  
- Configuration management (merchant, branch, POS settings)  
- Integration with E-Barimt reference endpoints

---

## 🧩 Base URL

```
http://localhost:4001/posapi
```

---

## 📦 Endpoints

### === WRAPPER Services ===

| Endpoint | Method | Description |
|-----------|---------|-------------|
| `/addBill` | `POST` | Create new receipt (Баримт үүсгэх) |
| `/updateBill` | `POST` | Update existing receipt (Баримт засах) |
| `/deleteBill` | `POST` | Delete a receipt by orderId (Баримт устгах) |
| `/addBillInvoice` | `POST` | Create B2B/B2C invoice type receipt |
| `/updateBillInvoice` | `POST` | Update invoice type receipt |
| `/settings` | `GET` | Retrieve POS API settings (Тохиргоо авах) |
| `/settings` | `POST` | Create or upsert settings (Тохиргоо үүсгэх) |
| `/settings` | `PUT` | Update settings (Тохиргоо засах) |
| `/settings` | `DELETE` | Delete settings (Тохиргоо устгах) |
| `/logs` | `GET` | View logs of sent receipts |
| `/returns` | `GET` | View logs of returned (deleted) receipts |
| `/updates` | `GET` | View logs of updated receipts |
| `/info/branches` | `GET` | Get list of districts and branches (Дүүргүүдийн мэдээлэл) |
| `/info/product-tax-codes` | `GET` | Retrieve VAT category codes (Бараа үйлчилгээний мэдээлэл) |

---

### === POSAPI Services ===

| Endpoint | Method | Description |
|-----------|---------|-------------|
| `/rest/receipt` | `POST` | Save a payment receipt (Төлбөрийн баримт хадгалах) |
| `/rest/receipt` | `DELETE` | Return or cancel a receipt (Төлбөрийн баримт буцаах) |
| `/rest/sendData` | `GET` | Send stored receipts to E-Barimt system |
| `/rest/info` | `GET` | Fetch operational info from E-Barimt |

---

### === E-Barimt Services ===

| Endpoint | Description |
|-----------|-------------|
| `https://api.ebarimt.mn/api/info/check/getBranchInfo` | Get district (branch) info |
| `https://api.ebarimt.mn/api/info/check/getInfo?tin={TIN}` | Get merchant or entity registration info |
| `https://api.ebarimt.mn/api/receipt/receipt/getProductTaxCode` | Get product tax codes for VAT classification |

---

## 🧠 Example Requests

### ➤ Create a Bill
```http
POST /posapi/addBill
Content-Type: application/json

{
  "OrderId": "ORD-1002",
  "CustomerTin": "61200064714",
  "MerchantTin": "37900846788",
  "Items": [
    { "barCode": "ITEM-001", "name": "Test Item A", "qty": 2, "unitPrice": 1000 }
  ]
}
```

### ➤ Update a Bill
```http
POST /posapi/updateBill
{
  "OrderId": "ORD-1003",
  "CustomerTin": "61200064714",
  "MerchantTin": "37900846788",
  "Items": [
    {
      "barCode": "ITEM-002",
      "name": "Test Item A",
      "qty": 2,
      "unitPrice": 1000,
      "EVAT": "VAT_ABLE",
      "isNhat": false
    }
  ]
}
```

### ➤ Create POS Settings
```http
POST /posapi/settings
{
  "merchantTin": "37900846789",
  "posNo": "101319842",
  "districtCode": "3504",
  "branchNo": "001",
  "billIdSuffix": "01",
  "updatedAt": "2025-11-04 05:28:22"
}
```

---

## 🧾 Logging Endpoints

| Route | Description |
|--------|--------------|
| `/logs?limit=20&offset=0` | Logs of sent receipts |
| `/returns?limit=20&offset=0` | Logs of returned (cancelled) receipts |
| `/updates?limit=20&offset=0` | Logs of updated receipts |

---

## ⚙️ Environment Variables

| Key | Description |
|-----|-------------|
| `DB_PATH` | SQLite file path (default: `data/posapi.db`) |
| `MERCHANT_TIN` | Default merchant TIN |
| `POS_NO` | POS terminal number |
| `DISTRICT_CODE` | District or branch code |
| `BRANCH_NO` | Branch number |
| `BILL_ID_SUFFIX` | Suffix used in bill numbering |

---

## 🧑‍💻 Development

### Start local server
```bash
npm install
npm run dev
```

Server will start on:
```
http://localhost:4001
```

### Database
SQLite database auto-creates under `data/posapi.db` with the following tables:
- `pos_api_logs`
- `pos_api_update_logs`
- `pos_api_return_bill_logs`
- `pos_api_settings`

---

## 📘 Notes
- Each merchant’s configuration is uniquely identified by `merchantTin`.  
- All receipt logs are automatically recorded (create, update, return).  
- Invoice routes automatically choose between `B2B_INVOICE` and `B2C_INVOICE` types.  
- Supports integration with external backends such as **NestJS**, **Flutter**, or **DevExpress ERP** modules.

---

## 📂 Postman Collection

Import the included file:

```
posapi-module.postman_collection.json
```

Use it to test endpoints quickly with predefined examples.

---

## 🏁 License

MIT © 2025 — STAR SHOP POS API Wrapper  
