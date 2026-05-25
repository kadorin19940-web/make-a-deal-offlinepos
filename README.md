# 🏪 Make a Deal POS

> ระบบขายหน้าร้าน (Point of Sale) ออฟไลน์ ใช้งานได้โดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต  
> Built with Electron + React + TypeScript + SQLite

---

## ✨ Features

### 🛒 หน้าขาย (POS)
- ค้นหาสินค้าด้วยชื่อ / บาร์โค้ด / SKU
- กรองตามหมวดหมู่
- ตะกร้าสินค้า (เพิ่ม/ลด/ลบ)
- ส่วนลดต่อรายการ และ ส่วนลดรวมบิล
- ระบบคูปอง
- เลือกลูกค้า + ราคาระดับ
- ชำระเงิน: เงินสด / บัตร / โอน / QR PromptPay / ผสม
- ใช้/สะสมแต้ม Loyalty
- พักบิล (Hold) และเรียกคืน
- ใบเสร็จ / พิมพ์ (Thermal 58/80mm, PDF A4/A5)

### 📦 สินค้าและหมวดหมู่
- CRUD สินค้า พร้อม barcode / SKU
- ราคา 3 ระดับ (ปลีก/ส่ง/สมาชิก)
- import/export CSV
- จัดการหมวดหมู่ + สี + emoji

### 🏭 คลังสินค้า
- ดูสต็อกทุกรายการ + alert ใกล้หมด
- รับสินค้าเข้า / ตัดออก / ปรับยอด
- ใบสั่งซื้อ (PO) กับซัพพลายเออร์
- ประวัติการเคลื่อนไหวสต็อก

### 👥 ลูกค้า
- CRUD ลูกค้า 4 ประเภท
- ประวัติการซื้อ
- ระบบแต้มสะสม Loyalty
- สิทธิ์เครดิต

### 📊 รายงาน
- ยอดขายรายวัน/สัปดาห์/เดือน
- กราฟรายได้
- สินค้าขายดี / ลูกค้าประจำ
- มูลค่าสต็อก
- export Excel / PDF

### ⚙️ ระบบหลังร้าน
- จัดการผู้ใช้งาน + สิทธิ์
- เปิด-ปิดกะ + สรุปยอดกะ
- สำรองข้อมูลอัตโนมัติ
- ตั้งค่า VAT / ใบเสร็จ / ล็อกหน้าจอ

---

## 🚀 เริ่มต้นใช้งาน

### Requirements
- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- Windows 10+ / macOS 11+ / Ubuntu 20+

### Installation

**Windows:**
```bat
setup.bat
```

**macOS / Linux:**
```bash
chmod +x setup.sh && ./setup.sh
```

**Manual:**
```bash
npm install --legacy-peer-deps
npx electron-rebuild -f -w better-sqlite3
```

### Development
```bash
npm run dev
```

### Build & Package
```bash
npm run dist:win    # Windows NSIS installer
npm run dist:mac    # macOS DMG
npm run dist:linux  # Linux AppImage
```

---

## 🔐 Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | ผู้ดูแลระบบ |
| `manager` | `manager123` | ผู้จัดการ |
| `cashier` | `cashier123` | พนักงานขาย |

---

## 🎹 Keyboard Shortcuts (POS)

| Key | Action |
|-----|--------|
| `F1` | โฟกัสช่องค้นหา |
| `F2` | เปิดหน้าชำระเงิน |
| `Esc` | ปิด modal |

---

## 🗄️ Database

SQLite ที่เก็บใน:
- **Windows:** `%APPDATA%\make-a-deal-pos\make-a-deal-pos.db`
- **macOS:** `~/Library/Application Support/make-a-deal-pos/make-a-deal-pos.db`
- **Linux:** `~/.config/make-a-deal-pos/make-a-deal-pos.db`

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 28 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + Glass Morphism |
| State | Zustand |
| Database | SQLite (better-sqlite3) |
| Charts | Recharts |
| Icons | Lucide React |
| Font | Sarabun (Google Fonts) |

---

## 📂 Project Structure

```
make-a-deal-pos/
├── electron/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # IPC bridge (contextBridge)
│   ├── database.ts      # SQLite schema + seed
│   └── ipc/             # IPC handlers (products, sales, ...)
├── src/
│   ├── pages/           # React pages
│   │   ├── POS/         # หน้าขาย + modals
│   │   ├── Dashboard/
│   │   ├── Products/
│   │   ├── Inventory/
│   │   ├── Customers/
│   │   ├── Reports/
│   │   ├── Sessions/
│   │   ├── Settings/
│   │   └── ...
│   ├── components/      # Layout, Sidebar, LockScreen
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   └── styles/          # Global CSS + design tokens
├── setup.bat            # Windows setup
├── setup.sh             # Mac/Linux setup
└── electron-builder.json
```

---

## 📄 License

MIT License — สำหรับใช้งานเชิงพาณิชย์และส่วนตัว
