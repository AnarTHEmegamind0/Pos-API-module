# POS API Module

ST-Ebarimt API-тай холбогдох модуль. Frontend-ээс бэлэн тооцоолсон JSON хүлээн авч баримт үүсгэнэ.

## Суулгалт

```bash
# Dependencies суулгах
npm install

# Build хийх
npm run build

# Эхлүүлэх
npm start

# Development mode
npm run dev
```

## Тохиргоо

### Environment Variables

`.env` файл үүсгэх:

```env
# Заавал
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/posapi

# Optional
PORT=4001
POS_API_BASE_URL=http://127.0.0.1:7080
```

### POS Settings (Database)

POS тохиргоог API-аар дамжуулан DB-д хадгална:

```bash
# Тохиргоо нэмэх/засах
curl -X POST http://localhost:4001/posapi/settings \
  -H "Content-Type: application/json" \
  -d '{
    "merchantTin": "37900846788",
    "posNo": "10012188",
    "districtCode": "3402",
    "branchNo": "001",
    "billIdSuffix": "01"
  }'

# Тохиргоо харах
curl http://localhost:4001/posapi/settings/37900846788
```

## API Endpoints

### Bills

| Method | Endpoint                   | Тайлбар                    |
| ------ | -------------------------- | -------------------------- |
| POST   | `/posapi/addBill`          | Баримт үүсгэх              |
| POST   | `/posapi/updateBill`       | Баримт засах               |
| POST   | `/posapi/deleteBill`       | Баримт устгах              |
| GET    | `/posapi/receipt/:orderId` | Баримт хайх                |
| POST   | `/posapi/sendBills`        | Pending баримтуудыг илгээх |

### Settings

| Method | Endpoint                        | Тайлбар              |
| ------ | ------------------------------- | -------------------- |
| GET    | `/posapi/settings`              | Бүх тохиргоо         |
| GET    | `/posapi/settings/:merchantTin` | Тохиргоо харах       |
| POST   | `/posapi/settings`              | Тохиргоо нэмэх/засах |
| DELETE | `/posapi/settings/:merchantTin` | Тохиргоо устгах      |

### Info

| Method | Endpoint             | Тайлбар      |
| ------ | -------------------- | ------------ |
| GET    | `/posapi/info`       | POS мэдээлэл |
| GET    | `/posapi/tin/:regNo` | ТТД мэдээлэл |
| GET    | `/health`            | Health check |

## Баримтын төрлүүд

| Төрөл         | Тайлбар                |
| ------------- | ---------------------- |
| `B2C_RECEIPT` | Иргэнд баримт          |
| `B2B_RECEIPT` | Байгууллагад баримт    |
| `B2C_INVOICE` | Иргэнд нэхэмжлэх       |
| `B2B_INVOICE` | Байгууллагад нэхэмжлэх |

## Request/Response жишээ

### Баримт үүсгэх (B2C Receipt)

**Request:**

```json
POST /posapi/addBill
{
  "orderId": "ORDER-123",
  "type": "B2C_RECEIPT",
  "totalAmount": 1000,
  "totalVAT": 89.29,
  "totalCityTax": 17.86,
  "merchantTin": "37900846788",
  "districtCode": "3402",
  "branchNo": "001",
  "posNo": "10012188",
  "customerTin": "",
  "receipts": [
    {
      "taxType": "VAT_ABLE",
      "merchantTin": "37900846788",
      "totalAmount": 1000,
      "totalVAT": 89.29,
      "totalCityTax": 17.86,
      "items": [
        {
          "name": "Бараа",
          "barCode": "8901234567890",
          "barCodeType": "GS1",
          "classificationCode": "1410101",
          "measureUnit": "ш",
          "qty": 1,
          "unitPrice": 1000,
          "totalAmount": 1000,
          "totalVAT": 89.29,
          "totalCityTax": 17.86
        }
      ]
    }
  ],
  "payments": [
    {
      "code": "CASH",
      "status": "PAID",
      "paidAmount": 1000
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Data posted successfully",
  "data": {
    "orderId": "ORDER-123",
    "id": "037900846788001095050007210012476",
    "qrData": "1674169843884832895609011647941428576380654372755171632964501824942616901030312621213955059925866215849636916426660184761962962015786278739255817891949332404392021770750661327556881",
    "lottery": "PT 13752644",
    "date": "2026-01-15 08:10:51",
    "totalAmount": 1000,
    "totalVAT": 89.29,
    "totalCityTax": 17.86,
    "status": "SUCCESS"
  }
}
```

### Байгууллагад баримт (B2B Receipt)

```json
POST /posapi/addBill
{
  "orderId": "ORDER-124",
  "type": "B2B_RECEIPT",
  "customerTin": "12345678",
  "totalAmount": 5000,
  "totalVAT": 446.43,
  "totalCityTax": 89.29,
  ...
}
```

### Нэхэмжлэх (Invoice)

```json
POST /posapi/addBill
{
  "orderId": "INV-125",
  "type": "B2C_INVOICE",
  "totalAmount": 10000,
  ...
  "payments": [
    {
      "code": "CASH",
      "status": "PAID",
      "paidAmount": 10000
    }
  ]
}
```

### Баримт устгах

**Request:**

```json
POST /posapi/deleteBill
{
  "orderId": "ORDER-123",
  "merchantTin": "37900846788"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Data deleted successfully",
  "data": null
}
```

### Баримт хайх

```bash
GET /posapi/receipt/ORDER-123?merchantTin=37900846788
```

**Response:**

```json
{
  "success": true,
  "message": "Receipt found",
  "data": {
    "orderId": "ORDER-123",
    "merchantTin": "37900846788",
    "ebarimtId": "037900846788001095050007210012476",
    "lottery": "PT 13752644",
    "qrData": "...",
    "totalAmount": 1000,
    "totalVat": 89.29,
    "totalCityTax": 17.86,
    "receiptType": "B2C_RECEIPT",
    "success": true,
    "createdAt": "2026-01-15T08:10:51.000Z"
  }
}
```

## DB Schema

### pos_api_receipts

Баримтын бүрэн мэдээлэл хадгалах table.

| Column         | Type        | Тайлбар                     |
| -------------- | ----------- | --------------------------- |
| id             | SERIAL      | Primary key                 |
| order_id       | TEXT        | Захиалгын ID (frontend-ээс) |
| merchant_tin   | TEXT        | Худалдагчийн ТТД            |
| request_json   | JSONB       | Илгээсэн request            |
| response_json  | JSONB       | ST-Ebarimt-ийн хариу        |
| ebarimt_id     | TEXT        | Баримтын ID                 |
| lottery        | TEXT        | Сугалааны дугаар            |
| qr_data        | TEXT        | QR код                      |
| total_amount   | DECIMAL     | Нийт дүн                    |
| total_vat      | DECIMAL     | НӨАТ                        |
| total_city_tax | DECIMAL     | НХАТ                        |
| receipt_type   | TEXT        | Баримтын төрөл              |
| success        | BOOLEAN     | Амжилттай эсэх              |
| error_message  | TEXT        | Алдааны мэдээлэл            |
| created_at     | TIMESTAMPTZ | Үүсгэсэн огноо              |
| updated_at     | TIMESTAMPTZ | Засварласан огноо           |

### pos_api_settings

POS тохиргоо хадгалах table.

| Column         | Type        | Тайлбар           |
| -------------- | ----------- | ----------------- |
| merchant_tin   | TEXT        | Primary key - ТТД |
| pos_no         | TEXT        | POS дугаар        |
| district_code  | TEXT        | Дүүргийн код      |
| branch_no      | TEXT        | Салбарын дугаар   |
| bill_id_suffix | TEXT        | Баримтын suffix   |
| updated_at     | TIMESTAMPTZ | Засварласан огноо |

## Postman Collection

`postman/POS-API-Collection.json` файлыг Postman-д import хийж ашиглана.

## Татвар тооцоолол

Frontend дээр татвар тооцоолох жишээ:

```javascript
// Нийт дүнгээс татвар тооцоолох (НӨАТ + НХАТ багтсан үнэ)
function calculateTaxes(totalAmount, hasVAT, hasNHAT) {
  let divisor = 1;
  if (hasVAT) divisor += 0.1; // 10% НӨАТ
  if (hasNHAT) divisor += 0.02; // 2% НХАТ

  const baseAmount = totalAmount / divisor;
  const vat = hasVAT ? baseAmount * 0.1 : 0;
  const nhat = hasNHAT ? baseAmount * 0.02 : 0;

  return {
    baseAmount: round2(baseAmount),
    totalVAT: round2(vat),
    totalCityTax: round2(nhat),
    totalAmount: totalAmount,
  };
}

// Жишээ: 1000₮ (НӨАТ + НХАТ багтсан)
// calculateTaxes(1000, true, true)
// => { baseAmount: 892.86, totalVAT: 89.29, totalCityTax: 17.86, totalAmount: 1000 }
```

## Төлбөрийн төрлүүд

| Code           | Тайлбар     |
| -------------- | ----------- |
| `CASH`         | Бэлэн мөнгө |
| `PAYMENT_CARD` | Карт        |

## License

MIT
