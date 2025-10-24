# Panduan Proyek PowerGuard

## Gambaran Umum
PowerGuard adalah solusi pemantauan listrik yang menghubungkan aplikasi ponsel, server, dan perangkat keras STM32. Lewat aplikasi ini, pengguna dapat melihat berapa banyak listrik yang terpakai, menyalakan atau mematikan stop kontak pintar, serta membuat aturan otomatis berbasis lokasi. Tujuannya sederhana: membantu keluarga atau kantor mengontrol konsumsi listrik dengan mudah agar tagihan lebih hemat.

## Masalah yang Dipecahkan
Banyak orang kesulitan memantau pemakaian listrik setiap outlet dan sering lupa mematikan alat elektronik. PowerGuard memecahkan masalah itu dengan menampilkan data pemakaian secara langsung dan memberi kontrol jarak jauh. Sistem juga bisa mengirim pengingat ketika konsumsi melebihi batas yang ditentukan.

## Cara Kerja Singkat
1. Perangkat STM32 membaca arus listrik pada stop kontak pintar dan mengirim angka tersebut ke server lewat MQTT (protokol pesan ringan).
2. Server NestJS menyimpan data ke database PostgreSQL melalui Prisma dan menyiapkan API.
3. Aplikasi Expo di ponsel mengambil data dari server, menampilkan grafik, dan mengirim perintah kontrol jika pengguna ingin menyalakan atau mematikan outlet.
4. Jika ada aturan geofencing, server mengecek lokasi pengguna dan menjalankan perintah otomatis.

## Komponen Utama
- **Aplikasi PowerGuard (frontend)**: Dibangun dengan Expo dan React Native, folder kode berada di `app/`, tampilan diperkuat oleh komponen di `components/` dan pengelolaan data di `context/` serta `services/`.
- **Server PowerGuard (backend)**: Berbasis NestJS, sumber kode di `backend/src/`. Modul MQTT dan Prisma menangani komunikasi dengan perangkat dan database.
- **Perangkat STM32**: Stop kontak pintar yang membaca konsumsi listrik dan menerima perintah kontrol.

## Fitur Penting
- Grafik pemakaian listrik real time dan riwayat penggunaan.
- Kontrol outlet satu per satu dari layar ponsel.
- Aturan otomatis berbasis lokasi pengguna (geofencing).
- Laporan bulanan yang mudah dibaca.
- Simulator MQTT untuk pengujian tanpa perangkat fisik.

## Cara Mengalami Proyek Ini
1. Pastikan Node.js dan npm terpasang.
2. Klon repositori lalu jalankan `npm install` di akar proyek dan `npm run install:all` untuk mengunduh dependensi frontend serta backend.
3. Jalankan server backend dengan `npm run backend` dan aplikasinya dengan `npm start`. Scanner QR dari Expo Go dapat dipakai untuk mencoba di ponsel.
4. Untuk backend saja, buka Swagger di `http://localhost:3000/docs` agar bisa mencoba API tanpa menulis kode tambahan.

## Istilah yang Sering Muncul
- **Expo**: Kerangka kerja untuk membuat aplikasi mobile dengan JavaScript/TypeScript.
- **MQTT**: Cara perangkat mengirim dan menerima pesan ringan (misalnya angka konsumsi listrik) secara terus menerus.
- **Prisma**: Alat yang menghubungkan kode TypeScript dengan database PostgreSQL.

Dengan panduan ini, siapa pun dapat memahami fungsi PowerGuard, cara kerjanya, dan langkah awal untuk ikut mengembangkan atau sekadar mencoba sistem pemantauan listrik ini.
