!macro customHeader
  # Override default MultiUser page strings for Thai (LCID 1054)
  LangString multiUserPage.title 1054 "เลือกสิทธิ์ผู้ใช้งานสำหรับการติดตั้ง (Choose Installation Options)"
  LangString multiUserPage.subtitle 1054 "กรุณาเลือกสิทธิ์ในการติดตั้งระบบคิดเงินหน้าร้าน:\r\n\r\n• ติดตั้งสำหรับทุกคน (All Users): เหมาะสำหรับเครื่องหลัก (เครื่องแม่/LAN Host) เพื่อแชร์ฐานข้อมูลให้เครื่องลูกได้เสถียรที่สุด\r\n• ติดตั้งเฉพาะฉัน (Only Me): เหมาะสำหรับเครื่องแคชเชียร์เดี่ยว หรือเครื่องลูกข่าย (LAN Client) ทั่วไป\r\n\r\n🚨 สำคัญ: หากต้องการเป็นเครื่องแม่แชร์ข้อมูลระบบแลน (LAN Host) แนะนำให้ติดตั้งแบบ 'สำหรับทุกคน (All Users)' เพื่อความปลอดภัยด้านสิทธิ์เข้าถึงไฟล์หลัก!"
  LangString multiUserPage.allUsers 1054 "ติดตั้งสำหรับผู้ใช้ทุกคน (All Users) *แนะนำมากสำหรับเครื่องหลัก (LAN Host)*"
  LangString multiUserPage.currentUser 1054 "ติดตั้งเฉพาะบัญชีฉัน (Only Me / Current User) *สำหรับเครื่องลูกข่ายทั่วไป*"

  # Override for English (LCID 1033) as fallback
  LangString multiUserPage.title 1033 "Choose Installation Options"
  LangString multiUserPage.subtitle 1033 "Please select installation access:\r\n\r\n• Anyone using this computer (All Users): Recommended for Main PC (LAN Host) to share DB securely.\r\n• Only for me (Current User): Recommended for standalone cashiers or client stations.\r\n\r\n🚨 NOTE: To operate as a LAN Host PC, choose 'Anyone using this computer (All Users)' to guarantee DB file access!"
  LangString multiUserPage.allUsers 1033 "Anyone using this computer (All Users) *Recommended for LAN Host*"
  LangString multiUserPage.currentUser 1033 "Only for me (Current User) *Recommended for client stations*"
!macroend
