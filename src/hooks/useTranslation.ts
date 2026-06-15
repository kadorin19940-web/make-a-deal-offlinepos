// [FIXED: Translation Hook — Dynamic String Interpolation]
// [FIXED: Thailand Timezone (UTC+7)]
import { useSettingsStore } from '../store'
import { format, parseISO } from 'date-fns'
import { th, enUS } from 'date-fns/locale'

// Translation dictionary for English mappings
export const dictionaryEn: Record<string, string> = {
  // Sidebar & Navigation
  'แดชบอร์ด': 'Dashboard',
  'หน้าขาย': 'POS',
  'สินค้า': 'Products',
  'คลังสินค้า': 'Inventory',
  'ลูกค้า': 'Customers',
  'ซัพพลายเออร์': 'Suppliers',
  'รายงาน': 'Reports',
  'โปรโมชัน': 'Promotions',
  'เปิด-ปิดกะ': 'Sessions',
  'ตั้งค่า': 'Settings',

  // Employee / Cashier Roles & Headers
  'ผู้ดูแลระบบ': 'Admin',
  'ผู้จัดการ': 'Manager',
  'พนักงานขาย': 'Cashier',
  'กะเปิดอยู่': 'Active Shift',
  'ล็อก': 'Lock',
  'ออก': 'Logout',
  'ล็อกหน้าจอ': 'Lock Screen',
  'ออกจากระบบ': 'Logout',

  // Dashboard Stats & Text
  'ยอดขายวันนี้': "Today's Sales",
  'ยอดเมื่อวาน': "Yesterday's Sales",
  'สินค้าใกล้หมด': 'Low Stock Items',
  'ค่าเฉลี่ย/บิล': 'Avg Sales/Bill',
  'บิล': 'Bills',
  'รายการ': 'Items',
  'พร้อมเริ่มขายสินค้า': 'Ready to Sell',
  'เปิดหน้าขาย': 'Open POS',
  'เปิดหน้าจอ POS เพื่อเริ่มบันทึกการขาย': 'Open the POS screen to start selling.',
  'ยอดขาย 7 วัน': '7-Day Sales',
  'รายได้ย้อนหลัง': 'Historical Revenue',
  'สินค้าขายดี': 'Top Products',
  'สัปดาห์นี้': 'This Week',
  'เดือนนี้': 'This Month',

  // POS Page General
  'ค้นหาสินค้า บาร์โค้ด หรือ SKU... (F1)': 'Search product, barcode, or SKU... (F1)',
  'ทั้งหมด': 'All',
  'ยอดรวม': 'Subtotal',
  'ส่วนลด': 'Discount',
  'ใช้คูปอง': 'Use Coupon',
  'คูปองโค้ด': 'Coupon Code',
  'ภาษีมูลค่าเพิ่ม': 'VAT',
  'ยอดสุทธิ': 'Net Total',
  'ชำระเงิน': 'Pay',
  'เลือกลูกค้า': 'Select Customer',
  'ล้าง': 'Clear',
  'ตะกร้าว่าง · สแกนหรือเลือกสินค้า': 'Cart is empty · Scan or select items',
  'เปิดลิ้นชักเงินสด': 'Open Cash Drawer',
  'เงินสด': 'Cash',
  'บัตรเครดิต': 'Credit Card',
  'QR/โอน': 'QR/Transfer',
  'บัตร': 'Card',
  'โอน': 'Transfer',

  // Dynamic Strings
  'สินค้า {{count}} รายการ': '{{count}} items',
  'เหลือ {{qty}} {{unit}}': '{{qty}} {{unit}} left',
  'แต้มที่ได้รับ': 'Points Earned',
  'ใช้แต้มสะสม': 'Redeem Points',
  'แต้ม': 'Points',
  'ยืนยันการชำระ {{total}}': 'Confirm Payment {{total}}',
  'ยืนยันการชำระเงิน': 'Confirm Payment',
  'กำลังบันทึก...': 'Saving...',
  'พิมพ์ใบเสร็จ': 'Print Receipt',
  'เสร็จสิ้น': 'Done',
  'ยอดรวมสุทธิ': 'Subtotal',
  'ส่วนลดพิเศษ': 'Discount',
  'ยอดรวมทั้งสิ้น': 'Grand Total',
  'ชำระด้วย:': 'Paid by:',
  'เงินทอน': 'Change',
  'รับเงิน': 'Received',
  'ทอน': 'Change',
  'เลขอ้างอิง / Ref No.': 'Reference / Ref No.',
  'กรอกเลขอ้างอิง (ถ้ามี)': 'Enter reference (if any)',
  'ยอดที่ต้องชำระ': 'Amount Payable',
  'ชำระเงินสำเร็จ': 'Payment Successful',
  'กำลังพิมพ์ใบเสร็จ...': 'Printing receipt...',
  'พิมพ์ล้มเหลว:': 'Print failed:',
  'พิมพ์ใบเสร็จสำเร็จ': 'Print successful',
  'กำลังจำลองการพิมพ์ใบเสร็จ (Demo)': 'Simulating receipt print (Demo)',
  'ชำระเงินสำเร็จ! 🎉': 'Payment Successful! 🎉',
  'กรุณาเพิ่มสินค้าก่อน': 'Please add products first',
  'ยอดรับไม่เพียงพอ': 'Insufficient amount received',

  // Settings
  'ระบบจัดการร้านค้า': 'Shop Management System',
  'ทั่วไป': 'General',
  'ข้อมูลร้านค้า': 'Shop Profile',
  'ภาษีและราคา': 'Tax & Prices',
  'ใบเสร็จและการพิมพ์': 'Receipt & Printing',
  'ลิ้นชักและอุปกรณ์': 'Cash Drawer & Device',
  'จัดการผู้ใช้': 'Manage Users',
  'การจัดการลิขสิทธิ์': 'Manage License',
  'ภาษา/ทั่วไป': 'Language/General',
  'ภาษาและทั่วไป': 'Language & General',
  'ภาษาระบบ': 'System Language',
  'รูปแบบวันที่': 'Date Format',
  'แจ้งเตือนสินค้าใกล้หมด': 'Low Stock Alert',
  'บันทึกการตั้งค่าระบบสำเร็จ': 'Settings saved successfully',

  // Dynamic values
  'ปรับปรุงคลังสินค้า': 'Stock Adjustments',
  'เพิ่มผู้ใช้ใหม่': 'Add New User',
  'แก้ไขผู้ใช้ — {{name}}': 'Edit User — {{name}}',
  'ประเภทสินค้า': 'Categories',
  'รหัส': 'Code',
  'ชื่อ': 'Name',
  'ราคา': 'Price',
  'สต็อก': 'Stock',
  'จัดการ': 'Manage',
  'ค้นหา...': 'Search...',
  'เพิ่มสินค้า': 'Add Product',
  'นำเข้า CSV': 'Import CSV',
  'ส่งออก CSV': 'Export CSV',
  'มูลค่าคลัง': 'Stock Value',
  'สินค้าทั้งหมด': 'All Products',

  // Date/Time
  'เวลาเปิดกะ': 'Shift Open Time',
  'เวลาปิดกะ': 'Shift Close Time',
  'ยอดกะที่ควรมี': 'Expected Cash',
  'ผลต่าง': 'Difference',
  'สถานะ': 'Status',
  'หมายเหตุ': 'Note',
  'เปิดกะ': 'Open Shift',
  'ปิดกะ': 'Close Shift',
}

// B.E. / C.E. date formatting utility
export function formatAppDate(
  dateInput: string | Date | number | null | undefined,
  customFormat?: string
): string {
  if (!dateInput) return ''
  let date: Date
  if (typeof dateInput === 'string') {
    try {
      date = new Date(dateInput)
      if (isNaN(date.getTime())) {
        date = parseISO(dateInput)
      }
    } catch {
      return String(dateInput)
    }
  } else if (typeof dateInput === 'number') {
    date = new Date(dateInput)
  } else {
    date = dateInput
  }

  if (isNaN(date.getTime())) return ''

  const settingsStore = useSettingsStore.getState()
  const lang = settingsStore?.settings?.language || 'th'
  const template = customFormat || settingsStore?.settings?.date_format || 'dd/MM/yyyy'

  const locale = lang === 'en' ? enUS : th
  const ceYear = date.getFullYear()
  const beYear = ceYear + 543
  const targetYear = lang === 'th' ? beYear : ceYear

  // Determine year token length from template (yyyy = 4 digits, yy = 2 digits)
  const yearMatch = template.match(/y+/i)
  const yearTokenLen = yearMatch ? yearMatch[0].length : 4
  const yearStr = yearTokenLen <= 2 ? String(targetYear).slice(-2) : String(targetYear)

  // Use a sentinel with NO latin letters so date-fns won't touch it
  // We use the unicode snowman ☃ as a safe separator marker
  const SENTINEL = '☃'

  // Replace year tokens with escaped sentinel, format the rest normally
  const safeTemplate = template
    .replace(/y{1,4}/gi, `'${SENTINEL}'`)

  let formatted: string
  try {
    formatted = format(date, safeTemplate, { locale })
  } catch {
    // Fallback: just return ISO-like string
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${dd}/${mm}/${targetYear}`
  }

  // Replace sentinel with B.E./C.E. year
  formatted = formatted.replace(SENTINEL, yearStr)

  return formatted
}

// Helper: formats dates using UTC+7 explicitly
export function toThaiLocaleDateString(date: Date): string {
  // Convert standard JS date to a YYYY-MM-DD string matching UTC+7 local date
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
  const thaiTime = new Date(utc + (3600000 * 7))
  
  const yyyy = thaiTime.getFullYear()
  const mm = String(thaiTime.getMonth() + 1).padStart(2, '0')
  const dd = String(thaiTime.getDate()).padStart(2, '0')
  
  return `${yyyy}-${mm}-${dd}`
}

export function useTranslation() {
  const { settings } = useSettingsStore()
  const lang = settings.language === 'en' ? 'en' : 'th'

  const t = (key: string, replacements?: Record<string, string | number>) => {
    let text = key
    if (lang === 'en') {
      text = dictionaryEn[key] || key
    }

    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      })
    }
    return text
  }

  return { t, lang }
}
