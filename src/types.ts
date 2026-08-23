export type BentukSoal = 'pilihan_ganda_sederhana' | 'mcma' | 'kategori';

export type LevelKognitif = 'level_1' | 'level_2' | 'level_3';

export type JumlahOpsi = 4 | 5; // 4: A-D, 5: A-E

export type JenisSoal = 'tunggal' | 'grup';

export interface KisiKisiItem {
  id: string;
  userId?: string;
  no: number;
  bentukSoal: BentukSoal;
  levelKognitif: LevelKognitif;
  jenisSoal?: JenisSoal;
  elemenMateri: string;
  subElemenMateri: string;
  kompetensi: string;
  batasanCatatan: string;
  jumlahSoal: number;
  konteksNusantara?: string;
  stimulusTambahan?: string;
  konteksLokal?: string[];
  stimulusKonten?: string[];
  kualitasChecklist?: string[];
}

export interface Question {
  id: string;
  userId?: string;
  noSoal: number;
  kisiKisiId: string; // Reference to which Kisi-Kisi row this belongs to
  kompetensi: string;
  subKompetensi: string;
  bentukSoal: BentukSoal;
  shapes?: string;
  soal: string;
  stimulus?: string;
  opsi: string[]; // Options array (A, B, C, D, E) or statements for category
  kunciJawaban: string; // Kunci jawaban
  pembahasan: string; // Structured explanation
  kataKunci?: string; // Kata Kunci atau Konsep yang digunakan
  gambarUrl?: string; // URL Gambar, Ilustrasi, or Grafik (Opsional)
  gambarCaption?: string; // Keterangan / Alt text Gambar (Opsional)
  gambarPosisi?: 'center' | 'left' | 'right'; // Posisi rata gambar
  gambarUkuran?: 'small' | 'medium' | 'large' | 'full'; // Ukuran relatif tampilan gambar
}

export interface GeneratorConfig {
  mataPelajaran: string;
  definisi: string;
  muatan: string;
  kompetensi: string;
  bentukSoal: BentukSoal;
  levelKognitif: LevelKognitif;
  elemenMateri: string;
  subElemenMateri: string;
  batasanCatatan: string;
  jumlahOpsi: JumlahOpsi;
  jenisSoal: JenisSoal;
  jumlahSoal: number;
  konteksLokal: string[]; // selected contexts
  stimulusKonten: string[]; // selected stimulus modes
  kualitasChecklist: string[]; // selected quality checklist
}

export interface JadwalItem {
  id: string;
  bulan: 'Juli' | 'Agustus' | 'September' | 'Oktober';
  mingguKe: number;
  elemenMateri: string;
  subElemenMateri: string;
  kompetensi: string;
}

