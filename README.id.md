<div align="center">
  <a href="https://bjir.tech">
    <img src="https://i.ibb.co/XfgnW2BK/bjir-logo.png" alt="BJIR" width="200">
  </a>
</div>

<p align="center">Agen coding AI yang hemat token, untuk terminal.</p>

<p align="center"><b>Satu obsesi: mengerjakan hal yang sama dengan token jauh lebih sedikit.</b></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## Apa itu BJIR?

BJIR adalah agen coding AI yang kamu jalankan di terminal. Ia membaca dan mengedit kode, menjalankan perintah, dan berbicara dengan model (Claude, GPT, Gemini, MiMo, model lokal).

Bedanya ada pada penggunaan token. Setiap permintaan dipangkas, setiap balasan diarahkan agar ringkas, dan output tool yang berisik (log test, JSON besar, `git status`) dikompres sebelum sampai ke model. Optimasi ini tertanam di binary dan selalu aktif, jadi kamu hemat tanpa perlu mengonfigurasi apa pun. Lebih sedikit konteks masuk dan lebih sedikit teks keluar berarti biaya lebih murah, balasan lebih cepat, dan sesi lebih panjang.

## Instalasi

### npm (disarankan)

```bash
npm i -g bjir          # atau: bun add -g bjir / pnpm add -g bjir / yarn global add bjir
bjir                   # jalankan
```

### Dari source

```bash
git clone https://github.com/gogetrekt/bjir
cd bjir
bun install
./bin/bjir.sh
```

Agar `bjir` bisa dijalankan dari mana saja pada checkout source, buat symlink ke PATH-mu:

```bash
ln -s "$PWD/bin/bjir.sh" ~/.local/bin/bjir
```

### API key

BJIR butuh provider model. Jalankan `bjir`, buka dialog provider, lalu tambahkan satu (OpenAI-compatible, Anthropic-compatible, atau preset). Nama, base URL, key, dan models disimpan dan bertahan setelah restart.

## Mulai cepat

Jalankan `bjir` (cukup `bjir`) untuk membuka TUI interaktif:

```bash
bjir                       # buka TUI di direktori saat ini
bjir /path/to/project      # buka TUI di project tertentu
bjir run "ringkas perubahan hari ini"   # sekali jalan, non-interaktif
bjir gain                  # tampilkan token yang dihemat
```

Di dalam TUI: ketik untuk chat, tekan `Tab` untuk berpindah antara agen build (akses penuh) dan agen plan (read-only), jalankan `/reducer` untuk mengubah intensitas optimasi, dan lihat sidebar untuk penghitung token-dihemat secara langsung.

## Optimasi

Tertanam di binary, selalu aktif. Tidak ada yang perlu dikonfigurasi.

| Optimasi | Fungsinya |
| --- | --- |
| Ponytail | Aturan code-minimalism. Agen menulis perubahan terkecil yang benar, jadi balasan dan diff tetap kecil. |
| Caveman | Aturan gaya respons yang membuat model menjawab ringkas. Pemangkasan token output terbesar. Tiga tingkat intensitas (lihat `/reducer`). |
| I/O Refiner | Memangkas prompt yang sudah dirakit tepat sebelum dikirim, menekan token input. |
| Context Prune | Membuang histori basi setiap giliran agar konteks lama berhenti memakan token. |
| Read Dedup | Tidak mengirim ulang file yang sudah pernah dibaca. |
| Semantic Read | Mengembalikan bagian file yang relevan saja bila itu sudah cukup. |
| Kompresi output tool | Hasil tool besar dikompres sesuai jenis: SmartCrusher untuk JSON besar, Log Compressor untuk log build dan shell, dan CCR, yang menyimpan output penuh lalu membiarkan agen menariknya kembali sesuai kebutuhan. Lossless atau dilewati. |
| RTK | Membungkus perintah shell (`git`, `cargo`, `npm`, `bun`, `docker`) sehingga outputnya dikompres sebelum dilihat agen. |
| BJIR Gateway | Gateway lokal kompatibel-OpenAI yang merutekan ke beberapa provider dengan fallback otomatis dan mencatat penggunaan token. |

### Intensitas

Caveman punya tiga tingkat: `lite`, `standard`, `ultra`. Ganti langsung di TUI dengan `/reducer` (juga `/caveman`, `/ponytail`); berlaku pada pesan berikutnya. Dari CLI, `bjir profile [explain|balanced|ultra]` menyetel profil yang persisten. Set `BJIR_OPTIMIZE=0` untuk mematikan lapisannya.

## Penghematan

```bash
bjir gain              # tabel token yang dihemat
bjir gain --json       # format machine-readable
bjir gain --reset      # hapus histori
```

Angkanya berasal dari data sesi nyata. Sidebar TUI menampilkan total berjalan.

## Perintah

Jalankan `bjir <command> --help` untuk opsi.

| Perintah | Deskripsi |
| --- | --- |
| `bjir` | Menjalankan TUI interaktif (default). |
| `bjir run "<prompt>"` | Sekali jalan, non-interaktif. |
| `bjir serve` | Menjalankan server HTTP API headless. |
| `bjir attach` | Menyambung ke server yang berjalan. |
| `bjir gain` | Menampilkan ringkasan penghematan token. |
| `bjir compress` | Meng-caveman-kompres file memori (`CLAUDE.md`, `AGENTS.md`, `.opencode/memory.md`). |
| `bjir profile [name]` | Menampilkan atau mengganti profil optimasi. |
| `bjir gateway` | Menjalankan BJIR Gateway (biasanya otomatis). |
| `bjir models` | Menampilkan model yang tersedia. |
| `bjir providers` | Mengelola provider dan kredensial. |
| `bjir revoke [id]` | Menghapus provider yang tersambung. |
| `bjir agent` | Membuat dan mengelola agen. |
| `bjir mcp` | Mengelola server MCP. |
| `bjir github` | Menyiapkan dan menjalankan agen GitHub. |
| `bjir upgrade` | Memperbarui ke versi terbaru. |
| `bjir uninstall` | Meng-uninstall BJIR. |

## Konfigurasi

BJIR membaca config dari `~/.config/opencode/opencode.json` (disemai saat pertama dijalankan) dan `opencode.json` atau `.opencode/opencode.json` lokal di project. Provider yang ditambahkan lewat dialog connect ditulis ke sini. Optimasi bawaan bukan config; atur lewat `/reducer`, `bjir profile`, dan variabel environment `BJIR_*`.

## Agen

Ganti dengan `Tab`:

- build: agen akses penuh untuk menulis dan mengubah kode.
- plan: read-only, menolak edit dan bertanya sebelum menjalankan perintah.

Panggil subagen general untuk pencarian rumit dengan `@general`.

## Lisensi

MIT. BJIR adalah fork dari [opencode](https://github.com/anomalyco/opencode) dan tidak berafiliasi dengan atau didukung oleh tim opencode.
