# Panduan Teknis Backend PowerGuard

## Struktur Inti NestJS
- `src/main.ts` menginisialisasi NestFactory, mengaktifkan CORS untuk aplikasi mobile, menambahkan `ValidationPipe` global, lalu memublikasikan dokumentasi Swagger di `/docs` sebelum server berjalan pada port `process.env.PORT` atau `3000`.
- `src/app.module.ts` berperan sebagai root module. Di sini konfigurasi lingkungan (`ConfigModule.forRoot`) dibuat global, modul infrastruktur (`PrismaModule`, `MqttModule`) dan modul domain (`OutletsModule`, `PowerstripsModule`, `GeofenceModule`) di-import agar service dan controller mereka siap dipakai di seluruh aplikasi.

## Lapisan Infrastruktur
- `src/prisma.module.ts` menandai `PrismaService` sebagai provider global sehingga setiap service bisa mengakses database tanpa deklarasi ulang.
- `src/prisma.service.ts` memperluas `PrismaClient`, mengelola lifecycle koneksi (`$connect` saat init, `$disconnect` saat destroy), dan mencetak log keberhasilan koneksi.
- `src/mqtt/mqtt.module.ts` mengekspos `MqttService` (dan `MqttSimulatorService`) agar modul lain, terutama Outlet, mampu mengirim perintah ke broker HiveMQ.
- `src/mqtt/mqtt.service.ts` membuka koneksi `mqtts://` memakai kredensial `.env`, subscribe ke topik `powerguard/+/data`, mem-parsing payload JSON, lalu menyimpan metrik ke `UsageLog` via `PrismaService`. Fungsi `controlOutlet()` menerbitkan perintah ke `powerguard/{outlet_id}/control` sekaligus memperbarui `Outlet.state` di database.

## Modul Domain
- **Outlets** (`outlets.module.ts`, `outlets.controller.ts`, `outlets.service.ts`)
  - Modul meng-import `MqttModule` karena controller perlu mengirim MQTT.
  - Controller menyediakan endpoint daftar outlet, detail, rename, riwayat penggunaan, serta `PATCH /:id/state` yang memanggil `MqttService.controlOutlet()`.
  - Service menangani query Prisma untuk outlet, menyertakan relasi `powerStrip` dan `usageLogs`, serta menyediakan agregasi energi (hourly/daily/monthly/past 30 hari/today) memakai `$queryRaw`.
- **Powerstrips** (`powerstrips.*`)
  - Modul mempublikasikan endpoint daftar/ detail power strip serta pembuatan baru.
  - Controller injeksi `OutletsService` agar bisa menggunakan fungsi agregasi yang sama; metode `/usage/*` hanyalah wrapper.
  - Service mengembalikan power strip beserta `outlets` dan `geofenceSettings`, serta mengambil log pemakaian terbaru setiap outlet.
- **Geofence** (`geofence.*`)
  - Controller menghadirkan endpoint membaca dan menyimpan pengaturan geofence per power strip serta toggle status.
  - Service menyiapkan operasi `upsert`, membuat power strip default lewat helper `ensurePowerstripExists()` bila belum ada, dan menjaga nilai radius/auto shutdown.

## Skema Data & Relasi Prisma
`prisma/schema.prisma` mendefinisikan tabel PostgreSQL berikut:
- `PowerStrip` mempunyai banyak `Outlet` dan `GeofenceSetting`.
- `Outlet` mempunyai banyak `UsageLog` dan `NotificationLog` serta relasi balik ke `PowerStrip`.
- `UsageLog` menyimpan pembacaan arus/daya/energi per outlet; relasi ON DELETE CASCADE memastikan data ikut terhapus saat outlet dihapus.
- `NotificationLog` mencatat pesan notifikasi terkait outlet tertentu.
- `GeofenceSetting` menyimpan status dan parameter geofencing, terikat ke satu power strip.
Relasi-relasi ini terefleksi langsung pada properti Prisma (`powerStrip`, `outlets`, `usageLogs`, `geofenceSettings`) yang di-include oleh service guna menyajikan data kaya konteks.

## Alur Interaksi Antar Modul
1. **Kontrol Outlet**: request HTTP ke `PATCH /outlets/:id/state` → `OutletsController` → `MqttService.controlOutlet()` → publish MQTT ke perangkat STM32 → update `Outlet.state` di PostgreSQL.
2. **Ingest Data Pemakaian**: perangkat STM32 mengirim telemetry ke topik `powerguard/{outlet_id}/data` → `MqttService` menerima, mem-parse, dan menyimpan ke `UsageLog` → frontend membaca via endpoint `GET /outlets/:id/recent-usage` atau agregasi di `/powerstrips/:id/usage/*`.
3. **Pengaturan Geofence**: pengguna memanggil `POST /geofence` atau `PATCH /geofence/powerstrip/:id/enabled` → `GeofenceService` melakukan `upsert` berdasarkan `powerstripID`, sambil memastikan entitas `PowerStrip` tersedia.

Dengan memahami struktur modul, penyedia layanan infrastruktur, serta relasi data di atas, pengembang baru dapat menelusuri alur kode backend PowerGuard secara sistematis dan melakukan perubahan tanpa memutus hubungan antar komponen utama.
