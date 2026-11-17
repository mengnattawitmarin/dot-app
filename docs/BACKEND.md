# ตั้งค่าระบบออนไลน์ (Supabase + Firebase)

| ส่วน | ใช้ทำอะไร |
|---|---|
| **Supabase** | บัญชีผู้ใช้ (อีเมล + รหัสผ่าน), ฐานข้อมูล, เก็บไฟล์คลิป, คอมเมนต์, ถูกใจ, รายงานคลิป, ซิงก์รายการโปรด, กล่องแจ้งเตือน |
| **Firebase** | Push notification ขึ้นมือถือ (Firebase Cloud Messaging) เมื่อมีคนถูกใจ/คอมเมนต์คลิปของคุณ |

ถ้ายังไม่ได้ตั้งค่า แอปยังทำงานได้ปกติแบบในเครื่องทุกอย่าง — ระบบออนไลน์จะเปิดเองเมื่อใส่ค่าครบ
ทั้งสองบริการมีแพ็กเกจฟรีที่พอสำหรับเริ่มต้น

---

## ส่วนที่ 1 — Supabase (จำเป็น, ~10 นาที)

1. ไปที่ <https://supabase.com> → **New project**
   - Region: **Southeast Asia (Singapore)** (ใกล้ไทยที่สุด)
   - ตั้ง **Database password** แล้วจดไว้
2. **สร้างตาราง** — เลือกอย่างใดอย่างหนึ่ง
   - **ง่ายสุด:** เมนู **SQL Editor** → New query → วางเนื้อหาไฟล์ `supabase/migrations/20261117000000_init.sql` ทั้งไฟล์ → **Run**
   - **อัตโนมัติ:** ใส่ secrets ใน GitHub ตามข้อ 5 แล้วรัน workflow **Backend (Supabase)**
3. **ปิดการยืนยันอีเมล** (แอปใช้อีเมล + รหัสผ่าน จึงไม่ต้องส่งอีเมลเลย — ใช้แพ็กเกจฟรีได้)
   เมนู **Authentication → Sign In / Providers → Email** → ปิด **Confirm email** → Save
   > ถ้าภายหลังอยากยืนยันอีเมลหรือมีปุ่ม "ลืมรหัสผ่าน" ต้องตั้ง SMTP ของตัวเอง (Authentication → Emails → SMTP Settings) เช่น Resend หรือ Gmail
4. **คัดลอกค่าเชื่อมต่อ** — เมนู **Project Settings → API**
   - `Project URL` เช่น `https://abcd1234.supabase.co`
   - `anon public` key
5. **ใส่ใน GitHub** — repo → **Settings → Secrets and variables → Actions**
   - แท็บ **Variables** → New variable
     - `SUPABASE_URL` = Project URL
     - `SUPABASE_ANON_KEY` = anon public key
     (anon key เปิดเผยได้ ปลอดภัยด้วย Row Level Security ในไฟล์ SQL)
   - แท็บ **Secrets** (ถ้าอยากให้ GitHub อัปเดตฐานข้อมูล/ฟังก์ชันให้อัตโนมัติ)
     - `SUPABASE_ACCESS_TOKEN` — จาก supabase.com → Account → Access Tokens
     - `SUPABASE_PROJECT_REF` — ส่วน `abcd1234` ใน URL
     - `SUPABASE_DB_PASSWORD` — รหัสผ่านจากข้อ 1
6. ไปที่แท็บ **Actions** → **Deploy web** และ **Android APK** → **Run workflow**
   (หรือ push อะไรก็ได้ขึ้น main) — เว็บและ APK ตัวใหม่จะมีปุ่มเข้าสู่ระบบ และโพสต์คลิปสาธารณะได้

## ส่วนที่ 2 — Firebase push (ไม่บังคับ, ~10 นาที)

1. <https://console.firebase.google.com> → **Add project** (ปิด Google Analytics ได้)
2. **Add app → Android**
   - Package name: `com.mengnattawit.dot`
   - ดาวน์โหลด `google-services.json`
3. แปลงไฟล์เป็น base64 แล้วใส่เป็น secret `GOOGLE_SERVICES_JSON`
   - Mac/Linux: `base64 -i google-services.json | pbcopy` (หรือ `base64 -w0 google-services.json`)
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json")) | Set-Clipboard`
4. **ให้ Supabase ส่ง push ได้** — Firebase → ⚙️ Project settings → **Service accounts** → **Generate new private key**
   - ใส่เนื้อหาไฟล์ JSON ทั้งหมดเป็น secret `FIREBASE_SERVICE_ACCOUNT`
   - ตั้ง secret `WEBHOOK_SECRET` เป็นข้อความสุ่มอะไรก็ได้ (เช่น `dot-7f3k2m9q`)
   - รัน workflow **Backend (Supabase)** เพื่อ deploy ฟังก์ชัน `notify`
5. **เชื่อมตารางแจ้งเตือนกับฟังก์ชัน** — Supabase → **Database → Webhooks → Create a new hook**
   - Table: `notifications`, Events: **Insert**
   - Type: **Supabase Edge Functions** → เลือก `notify`
   - HTTP Headers: เพิ่ม `x-webhook-secret` = ค่าเดียวกับ `WEBHOOK_SECRET`
6. Push อะไรก็ได้ขึ้น main → APK ตัวใหม่จะมีสวิตช์ **การแจ้งเตือน** ในหน้าโปรไฟล์

> **iPhone:** ต้องมี Apple Developer account → สร้าง APNs Auth Key แล้วอัปโหลดใน Firebase → Project settings → Cloud Messaging และเปิด capability *Push Notifications* ใน Xcode

---

## ดูแลชุมชน (สำคัญสำหรับ Play Store / App Store)

- ผู้ใช้กด **⋯ → รายงานคลิปไม่เหมาะสม** ได้ทุกคลิป — ครบ **3 รายงาน คลิปจะถูกซ่อนอัตโนมัติ**
- ตรวจรายงาน: Supabase → **Table Editor → clip_reports**
- ซ่อน/คืนคลิป: **Table Editor → clips** → คอลัมน์ `hidden`
- ลบผู้ใช้: **Authentication → Users** → Delete (ข้อมูลทั้งหมดของเขาจะถูกลบตาม)
- ร้านค้าแอปกำหนดให้แอปที่มีคอนเทนต์จากผู้ใช้ต้องมีระบบรายงาน + ข้อกำหนดการใช้งาน + ช่องทางติดต่อ — ก่อนส่งขึ้นร้านควรเพิ่มหน้า Terms/Privacy

## ทดสอบในเครื่อง

```bash
cp .env.example .env    # ใส่ URL + anon key
npm run dev
```
