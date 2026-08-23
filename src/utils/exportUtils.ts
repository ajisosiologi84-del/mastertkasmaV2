import { KisiKisiItem, Question, JadwalItem } from '../types';
import * as XLSX from 'xlsx';

/**
 * Format string helper for bentuk soal
 */
export function getBentukSoalLabel(val: string): string {
  switch (val) {
    case 'pilihan_ganda_sederhana':
      return 'Pilihan Ganda Sederhana';
    case 'mcma':
      return 'Pilihan Ganda Kompleks (MCMA)';
    case 'kategori':
      return 'Pilihan Ganda Kompleks Kategori';
    default:
      return val;
  }
}

/**
 * Helper to clean option/statement text for table displays
 */
export function cleanOptionText(optStr: string): string {
  if (!optStr) return '';
  let text = optStr.trim();
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\*/g, '').trim();
  text = text.replace(/^pernyataan\s*[\d|a-e]\s*[\:\.\-]\s*/i, '').trim();
  text = text.replace(/^pernyataan\s*[\d|a-e]\s+/i, '').trim();
  text = text.replace(/^[\-\•\s]*\(?([A-Ea-e1-5])\)?[\.\)\:\-]\s*/, '').trim();
  text = text.replace(/^[A-Ea-e1-5]\s+/, '').trim();
  text = text.replace(/pilihan\s*jawaban\s*:\s*\(.*?\).*/i, '').trim();
  return text;
}

/**
 * Helper to detect if a question is PGK Kategori (Pilihan Ganda Kompleks Kategori)
 */
export function isKategoriSoal(q: { bentukSoal?: string; shapes?: string; soal?: string; kunciJawaban?: string; opsi?: string[] }): boolean {
  if (!q) return false;
  const b = (q.bentukSoal || '').toLowerCase();
  const s = (q.shapes || '').toLowerCase();
  if (b.includes('kategori') || s.includes('kategori') || b.includes('jodoh') || b.includes('pernyataan')) return true;

  const combined = `${q.soal || ''} ${q.kunciJawaban || ''} ${(q.opsi || []).join(' ')}`.toLowerCase();
  if (/pilihlah\s+(?:sesuai|benar|tepat|ya)/i.test(combined)) return true;
  if (/sesuai\s*atau\s*tidak\s*sesuai/i.test(combined)) return true;
  if (/benar\s*atau\s*salah/i.test(combined)) return true;
  if (/tepat\s*atau\s*tidak\s*tepat/i.test(combined)) return true;
  if (/ya\s*atau\s*tidak/i.test(combined)) return true;
  if (/kategori/i.test(combined) && /pernyataan/i.test(combined)) return true;
  if (/pernyataan\s*1\s*:/i.test(combined) && /pernyataan\s*2\s*:/i.test(combined)) return true;

  return false;
}

/**
 * Helper to detect PGK Kategori category pairs (e.g. Sesuai/Tidak Sesuai, Benar/Salah, Tepat/Tidak Tepat, Ya/Tidak, Fakta/Opini, Setuju/Tidak Setuju)
 */
export function getPgkCategories(soalText?: string, kunciText?: string): { cat1: string; cat2: string } {
  const combined = `${soalText || ''} ${kunciText || ''}`;
  
  // Try to parse dynamic categories from Markdown table header (e.g., | # | Pernyataan | Cat 1 | Cat 2 |)
  const tableHeaderMatch = combined.match(/\|\s*(?:#|no|nomor)\s*\|\s*(?:pernyataan|opsi|butir)\s*\|\s*([^|\r\n]+)\s*\|\s*([^|\r\n]+)\s*\|/i);
  if (tableHeaderMatch && tableHeaderMatch[1] && tableHeaderMatch[2]) {
    const header1 = tableHeaderMatch[1].trim().replace(/[*`_]/g, '');
    const header2 = tableHeaderMatch[2].trim().replace(/[*`_]/g, '');
    if (header1 && header2 && !header1.includes(':---') && !header2.includes(':---')) {
      return { cat1: header1, cat2: header2 };
    }
  }

  if (/fakta\s*atau\s*opini/i.test(combined) || (/fakta/i.test(combined) && /opini/i.test(combined))) {
    return { cat1: "Fakta", cat2: "Opini" };
  }

  if (/setuju\s*atau\s*tidak\s*setuju/i.test(combined) || /tidak\s*setuju/i.test(combined)) {
    return { cat1: "Setuju", cat2: "Tidak Setuju" };
  }

  if (/tepat\s*atau\s*tidak\s*tepat/i.test(combined) || /tidak\s*tepat/i.test(combined)) {
    return { cat1: "Tepat", cat2: "Tidak Tepat" };
  }

  if (/masuk\s*akal\s*atau\s*tidak\s*masuk\s*akal/i.test(combined) || /tidak\s*masuk\s*akal/i.test(combined)) {
    return { cat1: "Masuk Akal", cat2: "Tidak Masuk Akal" };
  }

  if (/positif\s*atau\s*negatif/i.test(combined) || (/positif/i.test(combined) && /negatif/i.test(combined))) {
    return { cat1: "Positif", cat2: "Negatif" };
  }
  
  if (/sesuai\s*atau\s*tidak\s*sesuai/i.test(combined) || /tidak\s*sesuai/i.test(combined)) {
    return { cat1: "Sesuai", cat2: "Tidak Sesuai" };
  }

  if (/benar\s*atau\s*salah/i.test(combined) || /salah/i.test(combined)) {
    return { cat1: "Benar", cat2: "Salah" };
  }

  if (/ya\s*atau\s*tidak/i.test(combined) || /tidak/i.test(combined)) {
    return { cat1: "Ya", cat2: "Tidak" };
  }

  if (/tepat/i.test(combined) && !/sesuai/i.test(combined)) {
    return { cat1: "Tepat", cat2: "Tidak Tepat" };
  }

  return { cat1: "Sesuai", cat2: "Tidak Sesuai" };
}

/**
 * Determine which category column (1 or 2) is indicated by kunciJawaban for option index optIdx (0 = A, 1 = B, etc.)
 */
export function getPgkCategoryIndex(
  kunciText: string | undefined, 
  optIdx: number, 
  optLetter: string, 
  cat1: string, 
  cat2: string
): 1 | 2 | 0 {
  if (!kunciText) return 0;
  const keyUpper = kunciText.trim();
  const letter = optLetter.toUpperCase();

  // Pattern 1: Search by Letter (A, B, C, D, E)
  const letterRegex = new RegExp(`(?:${letter}|Pernyataan\\s*${letter}|Pernyataan\\s*${optIdx+1})\\s*[:=(.-]?\\s*([^,|\\n;)]+)`, 'i');
  const letterMatch = keyUpper.match(letterRegex);
  if (letterMatch && letterMatch[1]) {
    const val = letterMatch[1].trim();
    if (val.toLowerCase().includes(cat2.toLowerCase())) return 2;
    if (val.toLowerCase().includes(cat1.toLowerCase())) return 1;
  }

  // Pattern 2: Search by Number (1, 2, 3, 4, 5)
  const numMatch = keyUpper.match(new RegExp(`(?:^|[,;|\\s])\\s*${optIdx + 1}\\s*[:=.).-]\\s*([^,|\\n;]+)`, 'i'));
  if (numMatch && numMatch[1]) {
    const val = numMatch[1].trim();
    if (val.toLowerCase().includes(cat2.toLowerCase())) return 2;
    if (val.toLowerCase().includes(cat1.toLowerCase())) return 1;
  }

  // Pattern 3: Comma/semicolon separated list without labels e.g. "SESUAI, TIDAK SESUAI, SESUAI, SESUAI"
  const parts = keyUpper.split(/[,;\n|]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > optIdx) {
    const targetPart = parts[optIdx];
    const cleanPart = targetPart.replace(/^(?:[A-E1-5]|Pernyataan\s*[A-E1-5])\s*[:=.).-]\s*/i, '').trim();
    if (cleanPart.toLowerCase().includes(cat2.toLowerCase())) return 2;
    if (cleanPart.toLowerCase().includes(cat1.toLowerCase())) return 1;
  }

  return 0;
}

/**
 * Format string helper for level kognitif
 */
export function getLevelKognitifLabel(val: string): string {
  switch (val) {
    case 'level_1':
      return 'Pemahaman (Knowing)';
    case 'level_2':
      return 'Penerapan (Applying)';
    case 'level_3':
      return 'Penalaran (Reasoning)';
    default:
      return val;
  }
}

/**
 * Export Kisi-Kisi (Matriks Asesmen) to Excel (.xls)
 */
export function exportKisiToExcel(items: KisiKisiItem[], mataPelajaran: string) {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #cccccc; padding: 8px; text-align: center;">${item.no}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${getBentukSoalLabel(item.bentukSoal)}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${getLevelKognitifLabel(item.levelKognitif)}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${item.elemenMateri}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${item.subElemenMateri}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${item.kompetensi}</td>
      <td style="border: 1px solid #cccccc; padding: 8px;">${item.batasanCatatan || '-'}</td>
      <td style="border: 1px solid #cccccc; padding: 8px; font-size: 9.5pt;">
        ${[
          item.konteksLokal && item.konteksLokal.length > 0 ? `Konteks: ${item.konteksLokal.join(', ')}` : '',
          item.konteksNusantara ? `Kustom Konteks: ${item.konteksNusantara}` : '',
          item.stimulusKonten && item.stimulusKonten.length > 0 ? `Stimulus: ${item.stimulusKonten.join(', ')}` : '',
          item.stimulusTambahan ? `Kustom Stimulus: ${item.stimulusTambahan}` : '',
          item.kualitasChecklist && item.kualitasChecklist.length > 0 ? `Standar Mutu: ${item.kualitasChecklist.join(', ')}` : ''
        ].filter(Boolean).join(' | ') || '-'}
      </td>
      <td style="border: 1px solid #cccccc; padding: 8px; text-align: center; font-weight: bold;">${item.jumlahSoal}</td>
    </tr>
  `
    )
    .join('');

  const totalSoal = items.reduce((sum, i) => sum + i.jumlahSoal, 0);

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Matriks Asesmen</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        th { background-color: #3b82f6; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>MATRIKS ASESMEN KISI-KISI SOAL TKA SMA</h2>
      <p><b>Mata Pelajaran:</b> ${mataPelajaran}</p>
      <p><b>Tanggal Ekspor:</b> ${new Date().toLocaleDateString('id-ID')}</p>
      <br/>
      <table style="border-collapse: collapse; border: 1px solid #cccccc; width: 100%;">
        <thead>
          <tr style="background-color: #1e3a8a; color: white;">
            <th style="border: 1px solid #cccccc; padding: 10px; width: 50px;">No</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Bentuk Soal</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Tingkat Kognitif</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Elemen/Materi</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Sub-elemen/Submateri</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Kompetensi</th>
            <th style="border: 1px solid #cccccc; padding: 10px;">Batasan/Catatan</th>
            <th style="border: 1px solid #cccccc; padding: 10px; min-width: 250px;">Konteks & Stimulus</th>
            <th style="border: 1px solid #cccccc; padding: 10px; width: 80px;">Jumlah Soal</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="background-color: #f3f4f6; font-weight: bold;">
            <td colspan="8" style="border: 1px solid #cccccc; padding: 8px; text-align: right;">Total Soal:</td>
            <td style="border: 1px solid #cccccc; padding: 8px; text-align: center;">${totalSoal}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kisi_Kisi_TKA_${mataPelajaran.replace(/\s+/g, '_')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Kisi-Kisi (Matriks Asesmen) to Word (.doc)
 */
export function exportKisiToWord(items: KisiKisiItem[], mataPelajaran: string, pageSize: string = 'A4') {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${item.no}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${getBentukSoalLabel(item.bentukSoal)}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${getLevelKognitifLabel(item.levelKognitif)}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${item.elemenMateri}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${item.subElemenMateri}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${item.kompetensi}</td>
      <td style="border: 1px solid #000000; padding: 6px;">${item.batasanCatatan || '-'}</td>
      <td style="border: 1px solid #000000; padding: 6px; font-size: 9pt;">
        ${[
          item.konteksLokal && item.konteksLokal.length > 0 ? `Konteks: ${item.konteksLokal.join(', ')}` : '',
          item.konteksNusantara ? `Kustom Konteks: ${item.konteksNusantara}` : '',
          item.stimulusKonten && item.stimulusKonten.length > 0 ? `Stimulus: ${item.stimulusKonten.join(', ')}` : '',
          item.stimulusTambahan ? `Kustom Stimulus: ${item.stimulusTambahan}` : '',
          item.kualitasChecklist && item.kualitasChecklist.length > 0 ? `Standar Mutu: ${item.kualitasChecklist.join(', ')}` : ''
        ].filter(Boolean).join(' | ') || '-'}
      </td>
      <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${item.jumlahSoal}</td>
    </tr>
  `
    )
    .join('');

  const totalSoal = items.reduce((sum, i) => sum + i.jumlahSoal, 0);

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${pageSize === 'F4' ? '21.5cm 33cm' : '21cm 29.7cm'};
          margin: 1.5cm 1.5cm 1.5cm 1.5cm;
        }
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.4; }
        h2 { color: #1e3a8a; text-align: center; margin-bottom: 5px; }
        .meta { font-size: 11pt; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th { background-color: #f2f2f2; font-weight: bold; text-align: left; border: 1px solid #000000; padding: 8px; }
        td { border: 1px solid #000000; padding: 6px; font-size: 10pt; }
      </style>
    </head>
    <body>
      <h2>MATRIKS ASESMEN KISI-KISI SOAL TKA SMA</h2>
      <div class="meta">
        <b>Mata Pelajaran:</b> ${mataPelajaran}<br/>
        <b>Tanggal:</b> ${new Date().toLocaleDateString('id-ID')}<br/>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">No</th>
            <th style="width: 12%;">Bentuk Soal</th>
            <th style="width: 12%;">Tingkat Kognitif</th>
            <th style="width: 12%;">Elemen/Materi</th>
            <th style="width: 12%;">Sub-elemen/Submateri</th>
            <th style="width: 15%;">Kompetensi</th>
            <th style="width: 10%;">Batasan/Catatan</th>
            <th style="width: 18%;">Konteks & Stimulus</th>
            <th style="width: 5%;">Jumlah Soal</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="font-weight: bold; background-color: #fafafa;">
            <td colspan="8" style="text-align: right; border: 1px solid #000000; padding: 6px;">Total Jumlah Soal:</td>
            <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${totalSoal}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kisi_Kisi_TKA_${mataPelajaran.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Questions (Pembuat Soal) to Word (.doc)
 */
export function exportQuestionsToWord(questions: Question[], mataPelajaran: string, pageSize: string = 'A4', examName: string = 'Ujian_TKA_SMA', showAnswerKey: boolean = false) {
  const content = questions
    .map((q) => {
      const isKategori = isKategoriSoal(q);
      let optionsHtml = '';

      if (isKategori) {
        const { cat1, cat2 } = getPgkCategories(q.soal, q.kunciJawaban);
        const validOpts = (q.opsi || []).filter(opt => {
          const txt = cleanOptionText(opt).trim();
          return txt !== '' && txt !== '-' && txt !== '–' && txt !== '—';
        });

        const rows = validOpts.map((opt, i) => {
          const optLetter = String.fromCharCode(65 + i);
          const optText = cleanOptionText(opt);
          const catSel = getPgkCategoryIndex(q.kunciJawaban, i, optLetter, cat1, cat2);
          const isCat1 = showAnswerKey && catSel === 1;
          const isCat2 = showAnswerKey && catSel === 2;

          return `
            <tr>
              <td style="border: 1px solid #333333; padding: 6px; text-align: center; font-weight: bold; width: 6%; font-size: 10pt;">${i + 1}.</td>
              <td style="border: 1px solid #333333; padding: 6px; font-size: 10pt; line-height: 1.4;">${optText}</td>
              <td style="border: 1px solid #333333; padding: 6px; text-align: center; width: 18%; font-size: 10pt; ${isCat1 ? 'background-color: #dcfce7; font-weight: bold;' : ''}">
                ${isCat1 ? '<b>[ X ]</b>' : '(&nbsp;&nbsp;&nbsp;)'}
              </td>
              <td style="border: 1px solid #333333; padding: 6px; text-align: center; width: 18%; font-size: 10pt; ${isCat2 ? 'background-color: #dcfce7; font-weight: bold;' : ''}">
                ${isCat2 ? '<b>[ X ]</b>' : '(&nbsp;&nbsp;&nbsp;)'}
              </td>
            </tr>
          `;
        }).join('');

        optionsHtml = `
          <div style="margin: 12px 0;">
            <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #333333; font-family: 'Calibri', 'Arial', sans-serif;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #333333; padding: 6px; text-align: center; width: 6%; font-size: 10pt; font-weight: bold;">#</th>
                  <th style="border: 1px solid #333333; padding: 6px; text-align: left; font-size: 10pt; font-weight: bold;">Pernyataan</th>
                  <th style="border: 1px solid #333333; padding: 6px; text-align: center; width: 18%; font-size: 10pt; background-color: #e5e7eb; font-weight: bold;">${cat1}</th>
                  <th style="border: 1px solid #333333; padding: 6px; text-align: center; width: 18%; font-size: 10pt; background-color: #e5e7eb; font-weight: bold;">${cat2}</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      } else {
        optionsHtml = (q.opsi || [])
          .map((opt) => {
            return `<p style="margin: 3px 0 3px 20px; font-size: 11pt;">${opt}</p>`;
          })
          .join('');
      }

      return `
      <div style="margin-bottom: 25px; page-break-inside: avoid;">
        <table style="border: 1px solid #aaaaaa; width: 100%; border-collapse: collapse; background-color: #fbfbfb; margin-bottom: 10px;">
          <tr>
            <td style="padding: 5px 10px; font-weight: bold; width: 15%; background-color: #eaeaea; border-right: 1px solid #aaaaaa;">No Soal</td>
            <td style="padding: 5px 10px; font-weight: bold; width: 85%;">${q.noSoal}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; font-weight: bold; background-color: #eaeaea; border-right: 1px solid #aaaaaa;">Kompetensi</td>
            <td style="padding: 5px 10px; font-size: 10pt;">${q.kompetensi}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; font-weight: bold; background-color: #eaeaea; border-right: 1px solid #aaaaaa;">Sub Kompetensi</td>
            <td style="padding: 5px 10px; font-size: 10pt;">${q.subKompetensi}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; font-weight: bold; background-color: #eaeaea; border-right: 1px solid #aaaaaa;">Bentuk Soal</td>
            <td style="padding: 5px 10px; font-size: 10pt; font-style: italic;">${getBentukSoalLabel(q.bentukSoal)}</td>
          </tr>
        </table>

        ${q.stimulus ? `<div style="border-left: 3px solid #1e3a8a; padding-left: 10px; margin: 10px 0; font-style: italic; font-size: 11pt; background-color: #f9f9f9; padding: 8px;"><b>Stimulus:</b><br/>${q.stimulus.replace(/\n/g, '<br/>')}</div>` : ''}
        
        ${q.gambarUrl && q.gambarUrl.trim() !== '' ? `
        <div style="margin: 15px 0; text-align: center; background-color: #fafafa; padding: 10px; border: 1px solid #eeeeee; border-radius: 8px;">
          <p style="font-size: 9pt; color: #666666; margin: 0 0 5px 0; font-weight: bold;">[Ilustrasi / Grafik No. ${q.noSoal}]</p>
          ${q.gambarUrl.trim().toLowerCase().startsWith('<svg') ? q.gambarUrl : `<img src="${q.gambarUrl}" style="max-width: 400px; max-height: 250px; display: block; margin: 0 auto;"/>`}
        </div>
        ` : ''}

        <p style="margin: 10px 0; font-weight: bold; font-size: 11pt;">Pertanyaan:</p>
        <p style="margin: 5px 0 10px 0; font-size: 11pt; line-height: 1.5;">${q.soal.replace(/\n/g, '<br/>')}</p>

        ${optionsHtml ? `<div style="margin: 10px 0;">${optionsHtml}</div>` : ''}

        ${showAnswerKey ? `
        <p style="margin: 10px 0 5px 0; color: #15803d; font-weight: bold; font-size: 11pt;">Kunci Jawaban: <span style="background-color: #dcfce7; padding: 2px 8px; border-radius: 4px;">${q.kunciJawaban}</span></p>
        
        ${q.kataKunci ? `<p style="margin: 5px 0; font-size: 10.5pt; color: #4338ca;"><b>Kata Kunci / Konsep:</b> <span style="background-color: #e0e7ff; padding: 2px 8px; border-radius: 4px; color: #1e1b4b;">${q.kataKunci}</span></p>` : ''}
        
        <div style="margin-top: 10px; padding: 8px; border: 1px dashed #cccccc; background-color: #fafafa; font-size: 10.5pt;">
          <b style="color: #4b5563;">Pembahasan:</b><br/>
          <p style="margin: 5px 0 0 0; line-height: 1.4; color: #374151;">${q.pembahasan.replace(/\n/g, '<br/>')}</p>
        </div>
        ` : ''}
        <hr style="border: 0; border-top: 1px solid #dddddd; margin-top: 20px; margin-bottom: 20px;"/>
      </div>
    `;
    })
    .join('');

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${pageSize === 'F4' ? '21.5cm 33cm' : '21cm 29.7cm'};
          margin: 2cm 2cm 2cm 2cm;
        }
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; color: #333333; }
        h2 { color: #1e3a8a; text-align: center; margin-bottom: 5px; }
        .meta-header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 30px; font-size: 11pt; }
      </style>
    </head>
    <body>
      <h2>${examName.toUpperCase()}</h2>
      <div class="meta-header">
        <b>Mata Pelajaran:</b> ${mataPelajaran}<br/>
        <b>Jumlah Soal:</b> ${questions.length} butir<br/>
        <b>Tanggal Pembuatan:</b> ${new Date().toLocaleDateString('id-ID')}<br/>
      </div>

      ${content}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = buildSoalFilename(mataPelajaran, questions, examName, 'doc');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to build clean filename formatted as: [MataPelajaran]_[MateriPokok]_[BentukSoal]
 * Example: Sosiologi_Perubahan_Sosial_MCMA.doc, Sosiologi_Perubahan_Sosial_Kategori.doc, Sosiologi_Perubahan_Sosial_Sederhana.doc
 */
export function buildSoalFilename(mataPelajaran: string, questions: Question[], examName: string = 'Ujian_TKA_SMA', extension: string = 'doc'): string {
  const safeSubject = (mataPelajaran || 'Sosiologi').trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_');
  
  let rawMateri = (examName && examName !== 'Ujian_TKA_SMA' && examName !== 'Soal TKA SMA')
    ? examName
    : (questions && questions[0] && (questions[0].kompetensi || questions[0].subKompetensi)) || 'Materi_Pokok';
  
  let safeMateri = rawMateri.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_');
  if (!safeMateri || safeMateri === '_') safeMateri = 'Materi_Pokok';

  const { codeTag } = getBentukSoalCodeTag(questions);

  return `${safeSubject}_${safeMateri}_${codeTag}.${extension}`;
}

/**
 * Helper to determine Bentuk Soal code tag for filenames (Sederhana, MCMA, Kategori, or Campuran)
 */
export function getBentukSoalCodeTag(questions: Question[]): { codeTag: string; labelTag: string } {
  if (!questions || questions.length === 0) {
    return { codeTag: 'Campuran', labelTag: 'Campuran' };
  }

  const countPG = questions.filter(q => q.bentukSoal === 'pilihan_ganda_sederhana' || (!q.bentukSoal && !isKategoriSoal(q))).length;
  const countMCMA = questions.filter(q => q.bentukSoal === 'mcma').length;
  const countKategori = questions.filter(q => isKategoriSoal(q) || q.bentukSoal === 'kategori').length;
  const total = questions.length;

  if (countPG === total) {
    return { codeTag: 'Sederhana', labelTag: 'Pilihan Ganda Sederhana' };
  }
  if (countMCMA === total) {
    return { codeTag: 'MCMA', labelTag: 'Pilihan Ganda Kompleks MCMA' };
  }
  if (countKategori === total) {
    return { codeTag: 'Kategori', labelTag: 'Pilihan Ganda Kompleks Kategori' };
  }

  return { codeTag: 'Campuran', labelTag: 'Campuran' };
}

/**
 * Download Blank/Sample Template Excel for Soal TKA SMA based on Bentuk Soal
 */
export function downloadTemplateExcelSoal(mataPelajaran: string = 'Sosiologi', bentukFilter: string = 'all') {
  const headers = [
    'No Soal',
    'Kompetensi',
    'Bentuk Soal',
    'Soal (Stimulus + Pertanyaan)',
    'Opsi_A',
    'Opsi_B',
    'Opsi_C',
    'Opsi_D',
    'Opsi_E',
    'Kunci Jawaban',
    'Pembahasan'
  ];

  let templateTag = 'PG_Campuran';
  if (bentukFilter === 'pilihan_ganda_sederhana') templateTag = 'PG_Sederhana';
  else if (bentukFilter === 'mcma') templateTag = 'PG_MCMA';
  else if (bentukFilter === 'kategori') templateTag = 'PGK_Kategori';

  const sampleKategori1 = [
    1,
    'Menganalisis fenomena sosial yang dipengaruhi globalisasi secara kritis.',
    'Pilihan Ganda Kompleks Kategori',
    'Masyarakat adat Desa Sukatani menolak ekspansi perusahaan tambang multinasional yang mengancam kelestarian hutan adat mereka. Sebagai bentuk perlawanan kritis, mereka merevitalisasi hukum adat "Hutan Larangan" dan bekerja sama dengan LSM lingkungan untuk mengembangkan ekowisata berbasis masyarakat. Berdasarkan deskripsi tersebut, tentukan kategori Sesuai atau Tidak Sesuai pada pernyataan-pernyataan berikut mengenai bentuk sikap kritis dan pemberdayaan komunitas lokal.',
    'A. Penggunaan hukum adat "Hutan Larangan" merupakan bentuk penguatan kearifan lokal sebagai benteng pertahanan ekologis.',
    'B. Penolakan terhadap perusahaan multinasional menunjukkan bahwa masyarakat desa sepenuhnya menutup diri dari segala bentuk modernisasi.',
    'C. Pengembangan ekowisata merupakan strategi pemberdayaan ekonomi komunitas yang adaptif.',
    'D. Kolaborasi masyarakat adat dengan LSM mencerminkan hilangnya kemandirian lokal.',
    'E. Langkah masyarakat tersebut menunjukkan bahwa kapitalisme global selalu ditaklukkan melalui isolasi.',
    'A (Sesuai), B (Tidak Sesuai), C (Sesuai), D (Tidak Sesuai), E (Tidak Sesuai)',
    'Pembahasan: Pernyataan A Sesuai, B Tidak Sesuai, C Sesuai, D Tidak Sesuai, E Tidak Sesuai.'
  ];

  const sampleMCMA1 = [
    2,
    'Menganalisis fenomena sosial yang dipengaruhi globalisasi secara kritis.',
    'Pilihan Ganda Kompleks (MCMA)',
    'Pemerintah daerah menginisiasi program pemberdayaan UMKM melalui digitalisasi pemasaran produk kerajinan lokal. Manakah pernyataan berikut yang merupakan dampak positif langsung dari digitalisasi UMKM tersebut? (Pilihlah lebih dari satu jawaban benar)',
    'A. Memperluas jangkauan pasar hingga ke tingkat internasional tanpa batas geografis.',
    'B. Menghilangkan secara total peran distributor tradisional dalam rantai perdagangan.',
    'C. Meningkatkan efisiensi biaya promosi dan pemasaran produk kerajinan.',
    'D. Mempercepat transaksi keuangan antara pembeli dan penjual melalui sistem pembayaran digital.',
    'E. Menjamin seluruh pengrajin lokal langsung mendapatkan keuntungan finansial yang setara.',
    'A, C, D',
    'Pembahasan: Jawaban benar adalah A, C, dan D. Digitalisasi memperluas jangkauan pasar (A), efisiensi promosi (C), serta mempercepat transaksi (D). Pilihan B tidak tepat karena distributor tidak hilang total, dan pilihan E tidak realistis.'
  ];

  const samplePGSederhana1 = [
    3,
    'Menganalisis fenomena sosial yang dipengaruhi globalisasi secara kritis.',
    'Pilihan Ganda Sederhana',
    'Fenomena ditemukannya makanan khas Nusantara yang dipasarkan dalam bentuk kemasan siap saji di supermarket mancanegara merupakan salah satu wujud dari proses...',
    'A. Westernisasi',
    'B. Glokalisasi',
    'C. Sekularisasi',
    'D. Homogenisasi budaya',
    'E. Polarisasi sosial',
    'B',
    'Pembahasan: Jawaban paling tepat adalah B (Glokalisasi), yaitu perpaduan antara nilai/produk lokal dengan jaringan distribusi global.'
  ];

  let sampleRows: any[][] = [];
  if (templateTag === 'PG_Sederhana') {
    sampleRows = [samplePGSederhana1];
  } else if (templateTag === 'PG_MCMA') {
    sampleRows = [sampleMCMA1];
  } else if (templateTag === 'PGK_Kategori') {
    sampleRows = [sampleKategori1];
  } else {
    sampleRows = [sampleKategori1, sampleMCMA1, samplePGSederhana1];
  }

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 8 },  // No Soal
    { wch: 35 }, // Kompetensi
    { wch: 28 }, // Bentuk Soal
    { wch: 60 }, // Soal (Stimulus + Pertanyaan)
    { wch: 35 }, // Opsi_A
    { wch: 35 }, // Opsi_B
    { wch: 35 }, // Opsi_C
    { wch: 35 }, // Opsi_D
    { wch: 35 }, // Opsi_E
    { wch: 35 }, // Kunci Jawaban
    { wch: 60 }  // Pembahasan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Soal TKA SMA');

  const safeSubject = (mataPelajaran || 'Sosiologi').trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_');
  XLSX.writeFile(wb, `${safeSubject}_Materi_Pokok_${templateTag}.xlsx`);
}

/**
 * Export Questions (Pembuat Soal) to Excel (.xlsx)
 */
export function exportQuestionsToExcel(questions: Question[], mataPelajaran: string, examName: string = 'Ujian_TKA_SMA', showAnswerKey: boolean = true) {
  const headers = [
    'No Soal',
    'Kompetensi',
    'Bentuk Soal',
    'Soal (Stimulus + Pertanyaan)',
    'Opsi_A',
    'Opsi_B',
    'Opsi_C',
    'Opsi_D',
    'Opsi_E',
    'Kunci Jawaban',
    'Pembahasan'
  ];

  const rows = questions.map((q) => {
    let fullSoal = q.soal || '';
    if (q.stimulus && q.stimulus.trim()) {
      const normStim = q.stimulus.trim();
      if (!fullSoal.toLowerCase().includes(normStim.toLowerCase().substring(0, Math.min(20, normStim.length)))) {
        fullSoal = `${normStim}\n\n${fullSoal}`;
      }
    }

    let kompetensiText = q.kompetensi || '';
    if (q.subKompetensi && q.subKompetensi.trim() && !kompetensiText.toLowerCase().includes(q.subKompetensi.trim().toLowerCase())) {
      kompetensiText += ` (${q.subKompetensi.trim()})`;
    }

    const isKategori = isKategoriSoal(q);

    let formattedKunci = q.kunciJawaban || '';
    if (isKategori && showAnswerKey && q.opsi && q.opsi.length > 0) {
      if (!q.kunciJawaban.includes('(')) {
        const { cat1, cat2 } = getPgkCategories(q.soal, q.kunciJawaban);
        const parts: string[] = [];
        const validOpts = q.opsi.filter(opt => {
          const txt = cleanOptionText(opt).trim();
          return txt !== '' && txt !== '-' && txt !== '–' && txt !== '—';
        });

        validOpts.forEach((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const catIdx = getPgkCategoryIndex(q.kunciJawaban, idx, letter, cat1, cat2);
          if (catIdx === 1) {
            parts.push(`Pernyataan ${idx + 1}: ${cat1}`);
          } else if (catIdx === 2) {
            parts.push(`Pernyataan ${idx + 1}: ${cat2}`);
          }
        });
        if (parts.length > 0) {
          formattedKunci = parts.join(', ');
        }
      }
    }

    return [
      q.noSoal,
      kompetensiText,
      getBentukSoalLabel(q.bentukSoal),
      fullSoal,
      q.opsi[0] || '',
      q.opsi[1] || '',
      q.opsi[2] || '',
      q.opsi[3] || '',
      q.opsi[4] || '',
      showAnswerKey ? formattedKunci : '***',
      showAnswerKey ? (q.pembahasan || '') : '***'
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },  // No Soal
    { wch: 35 }, // Kompetensi
    { wch: 28 }, // Bentuk Soal
    { wch: 60 }, // Soal (Stimulus + Pertanyaan)
    { wch: 35 }, // Opsi_A
    { wch: 35 }, // Opsi_B
    { wch: 35 }, // Opsi_C
    { wch: 35 }, // Opsi_D
    { wch: 35 }, // Opsi_E
    { wch: 35 }, // Kunci Jawaban
    { wch: 60 }  // Pembahasan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Soal TKA SMA');

  const filename = buildSoalFilename(mataPelajaran, questions, examName, 'xlsx');
  XLSX.writeFile(wb, filename);
}

/**
 * Helper to convert Simple Markdown to styled HTML for Word Export and PDF Print
 */
export function markdownToHtmlForWord(markdown: string): string {
  if (!markdown) return '';
  
  // Split into paragraphs/blocks
  const blocks = markdown.split(/\n\n+/);
  
  const converted = blocks.map(block => {
    let trimmed = block.trim();
    if (!trimmed) return '';

    // Check if block is a Table
    if (trimmed.includes('|') && trimmed.split('\n').some(l => l.includes('|-') || l.includes('| -') || l.includes('|:'))) {
      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const isSeparator = (line: string) => /^\|?\s*:?-+:?\s*(\||\s*$)/.test(line) && line.includes('-');
        const headerLine = lines[0];
        const dataLines = lines.slice(1).filter(l => !isSeparator(l));

        const parseRow = (line: string) => {
          let t = line;
          if (t.startsWith('|')) t = t.slice(1);
          if (t.endsWith('|')) t = t.slice(0, -1);
          return t.split('|').map(c => c.trim());
        };

        const headers = parseRow(headerLine);
        const headerHtml = headers.map(h => 
          `<th style="border: 1px solid #1e3a8a; background-color: #1e3a8a; color: #ffffff; padding: 8px 12px; font-family: 'Times New Roman', serif; font-size: 11pt; font-weight: bold; text-align: left;">${parseInlineMarkdown(h)}</th>`
        ).join('');

        const rowsHtml = dataLines.map((rowLine, rIdx) => {
          const cells = parseRow(rowLine);
          const bg = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
          const cellHtml = cells.map(cell => 
            `<td style="border: 1px solid #cbd5e1; background-color: ${bg}; padding: 8px 12px; font-family: 'Times New Roman', serif; font-size: 11pt; color: #1e293b; text-align: left; vertical-align: top;">${parseInlineMarkdown(cell)}</td>`
          ).join('');
          return `<tr>${cellHtml}</tr>`;
        }).join('');

        return `<table style="width: 100%; border-collapse: collapse; margin-top: 15pt; margin-bottom: 15pt; border: 1.5px solid #1e3a8a;">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>`;
      }
    }
    
    // Headings
    if (trimmed.startsWith('# ')) {
      return `<h1 style="font-family: 'Times New Roman', 'Georgia', serif; font-size: 16pt; color: #1e3a8a; border-bottom: 2pt solid #1e3a8a; padding-bottom: 4px; margin-top: 24pt; margin-bottom: 12pt; font-weight: bold; text-transform: none; line-height: 1.3;">${parseInlineMarkdown(trimmed.slice(2))}</h1>`;
    }
    if (trimmed.startsWith('## ')) {
      return `<h2 style="font-family: 'Times New Roman', 'Georgia', serif; font-size: 14pt; color: #1e293b; margin-top: 18pt; margin-bottom: 10pt; font-weight: bold; border-left: 3.5pt solid #1e3a8a; padding-left: 8pt; line-height: 1.3;">${parseInlineMarkdown(trimmed.slice(3))}</h2>`;
    }
    if (trimmed.startsWith('### ')) {
      return `<h3 style="font-family: 'Times New Roman', 'Georgia', serif; font-size: 12pt; color: #334155; margin-top: 14pt; margin-bottom: 8pt; font-weight: bold; font-style: italic; line-height: 1.3;">${parseInlineMarkdown(trimmed.slice(4))}</h3>`;
    }
    
    // Blockquote
    if (trimmed.startsWith('> ')) {
      const cleanText = trimmed.replace(/^>\s?/gm, '').trim();
      return `<div style="border-left: 3.5pt solid #4f46e5; background-color: #f8fafc; padding: 10pt 15pt; margin: 12pt 0; font-style: italic; color: #334155; font-family: 'Times New Roman', serif; font-size: 11.5pt; text-align: justify; line-height: 1.5;">${parseInlineMarkdown(cleanText)}</div>`;
    }
    
    // Lists (bulleted)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('+ ')) {
      const lines = trimmed.split('\n');
      const itemsHtml = lines.map(line => {
        const itemText = line.replace(/^[*+\-\s]+/, '').trim();
        return `<li style="font-family: 'Times New Roman', serif; font-size: 12pt; margin-bottom: 6pt; line-height: 1.5; text-align: justify; color: #111827;">${parseInlineMarkdown(itemText)}</li>`;
      }).join('');
      return `<ul style="margin-top: 8pt; margin-bottom: 8pt; padding-left: 24pt; list-style-type: disc;">${itemsHtml}</ul>`;
    }
    
    // Lists (numbered)
    if (/^\d+\.\s/.test(trimmed)) {
      const lines = trimmed.split('\n');
      const itemsHtml = lines.map(line => {
        const itemText = line.replace(/^\d+\.\s+/, '').trim();
        return `<li style="font-family: 'Times New Roman', serif; font-size: 12pt; margin-bottom: 6pt; line-height: 1.5; text-align: justify; color: #111827;">${parseInlineMarkdown(itemText)}</li>`;
      }).join('');
      return `<ol style="margin-top: 8pt; margin-bottom: 8pt; padding-left: 24pt;">${itemsHtml}</ol>`;
    }
    
    // Normal paragraph
    return `<p style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin-top: 0; margin-bottom: 10pt; text-align: justify; color: #111827;">${parseInlineMarkdown(trimmed)}</p>`;
  }).join('\n');
  
  return converted;
}

function parseInlineMarkdown(text: string): string {
  if (!text) return '';
  
  // Use regex to tokenize bold-italic, bold, italic, code
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  const formatted = parts.map(part => {
    if (!part) return '';
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      const inner = part.slice(3, -3).replace(/\*/g, '');
      return `<strong><em>${inner}</em></strong>`;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2).replace(/\*/g, '');
      return `<strong>${inner}</strong>`;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const inner = part.slice(1, -1).replace(/\*/g, '');
      return `<em>${inner}</em>`;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return `<code style="background-color: #f3f4f6; padding: 2px 4px; font-family: Consolas, monospace; font-size: 10pt; color: #b91c1c; border: 1px solid #e5e7eb; border-radius: 3px;">${inner}</code>`;
    }
    // For plain text parts, strip any stray asterisks
    return part.replace(/\*/g, '');
  }).join('');

  return formatted;
}

/**
 * Export single Ringkasan Materi to Word (.doc)
 */
export function exportMateriToWord(kisi: any, content: string, mataPelajaran: string, pageSize: string = 'A4') {
  const parsedHtml = markdownToHtmlForWord(content);
  
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${pageSize === 'F4' ? '21.5cm 33cm' : '21cm 29.7cm'};
          margin-top: 4cm;
          margin-bottom: 3cm;
          margin-left: 4cm;
          margin-right: 3cm;
        }
        body { 
          font-family: 'Times New Roman', serif; 
          line-height: 1.5; 
          color: #111827; 
        }
        .header-kop { 
          text-align: center;
          border-bottom: 4px double #111827; 
          padding-bottom: 15px; 
          margin-bottom: 30px; 
        }
        .meta-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 25px; 
          border: 1px solid #111827;
        }
        .meta-table td { 
          border: 1px solid #111827; 
          padding: 8px 12px; 
          font-size: 11pt; 
          color: #111827; 
          font-family: 'Times New Roman', serif;
        }
        .title { 
          color: #111827; 
          font-family: 'Times New Roman', serif; 
          font-size: 16pt; 
          font-weight: normal; 
          margin: 0 0 5px 0; 
          text-transform: none;
        }
        .subtitle { 
          font-size: 11pt; 
          font-style: italic;
          color: #374151; 
          margin: 0; 
        }
      </style>
    </head>
    <body>
      <div class="header-kop">
        <h1 class="title">Bahan Ajar / Modul Pembelajaran</h1>
        <p class="subtitle">Kurikulum Merdeka - Standar Bahan Ajar Sekolah Menengah Atas</p>
      </div>
      
      <table class="meta-table">
        <tr style="background-color: #f3f4f6;">
          <td style="width: 30%; font-weight: bold;">Mata Pelajaran</td>
          <td style="width: 70%; font-weight: bold; color: #111827;">${mataPelajaran.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Elemen / Capaian</td>
          <td>${kisi.elemenMateri}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Sub-Elemen / Materi Pokok</td>
          <td>${kisi.subElemenMateri}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Target Kompetensi Dasar</td>
          <td>${kisi.kompetensi}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Tingkat Kemampuan Kognitif</td>
          <td>${getLevelKognitifLabel(kisi.levelKognitif)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Tanggal Penyusunan / Ekspor</td>
          <td>${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
      </table>
      
      <div style="margin-top: 15px;">
        ${parsedHtml}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MODUL_AJAR_No_${kisi.no}_${kisi.elemenMateri.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export all Ringkasan Materi to Word (.doc) in a single document
 */
export function exportAllMateriToWord(items: any[], materials: Record<string, string>, mataPelajaran: string, pageSize: string = 'A4') {
  const compiledContent = items
    .filter(item => !!materials[item.id])
    .map((item, index) => {
      const parsedHtml = markdownToHtmlForWord(materials[item.id]);
      const pageBreak = index > 0 ? '<br clear="all" style="page-break-before: always; mso-special-character: line-break;" />' : '';
      
      return `
        ${pageBreak}
        <div style="border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 20px; background-color: #f9fafb; padding: 12px 15px; border-left: 5px solid #111827;">
          <h2 style="font-family: 'Times New Roman', serif; font-size: 14pt; color: #111827; margin: 0 0 6px 0; font-weight: normal; text-transform: none;">Modul ${item.no}: ${item.elemenMateri}</h2>
          <p style="font-size: 11pt; color: #111827; margin: 0; font-family: 'Times New Roman', serif;"><b>Sub-Materi Pokok:</b> ${item.subElemenMateri}</p>
          <p style="font-size: 11pt; color: #111827; margin: 3px 0 0 0; font-family: 'Times New Roman', serif;"><b>Kompetensi:</b> ${item.kompetensi} | <b>Level:</b> ${getLevelKognitifLabel(item.levelKognitif)}</p>
        </div>
        
        <div style="margin-top: 15px; margin-bottom: 30px;">
          ${parsedHtml}
        </div>
      `;
    })
    .join('\n');

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${pageSize === 'F4' ? '21.5cm 33cm' : '21cm 29.7cm'};
          margin-top: 4cm;
          margin-bottom: 3cm;
          margin-left: 4cm;
          margin-right: 3cm;
        }
        body { 
          font-family: 'Times New Roman', serif; 
          line-height: 1.5; 
          color: #111827; 
        }
        .header-kop { 
          border-bottom: 4px double #111827; 
          padding-bottom: 15px; 
          margin-bottom: 35px; 
          text-align: center; 
        }
        .title { 
          color: #111827; 
          font-family: 'Times New Roman', serif; 
          font-size: 18pt; 
          font-weight: normal; 
          margin: 0 0 5px 0; 
          text-transform: none;
        }
        .subtitle { 
          font-size: 11pt; 
          font-style: italic;
          color: #374151; 
          margin: 0; 
        }
      </style>
    </head>
    <body>
      <div class="header-kop">
        <h1 class="title">Kumpulan Modul Ajar dan Bahan Ajar Lengkap</h1>
        <p class="subtitle">Mata Pelajaran: <b>${mataPelajaran}</b></p>
        <p style="font-size: 10pt; color: #4b5563; margin: 5px 0 0 0; font-family: 'Times New Roman', serif;">Diekspor secara otomatis pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      
      <div style="margin-top: 20px;">
        ${compiledContent}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kumpulan_Modul_Ajar_${mataPelajaran.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Jadwal Rencana Pembelajaran to Excel (.xls)
 */
export function exportJadwalToExcel(items: JadwalItem[], mataPelajaran: string) {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #cccccc; padding: 8px; text-align: center; font-weight: bold; background-color: #f8fafc;">${item.bulan}</td>
      <td style="border: 1px solid #cccccc; padding: 8px; text-align: center;">Minggu ke-${item.mingguKe}</td>
      <td style="border: 1px solid #cccccc; padding: 8px; font-weight: 500;">${item.elemenMateri}</td>
      <td style="border: 1px solid #cccccc; padding: 8px; color: #475569;">${item.subElemenMateri}</td>
      <td style="border: 1px solid #cccccc; padding: 8px; font-style: italic;">${item.kompetensi}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Jadwal Pembelajaran</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        th { background-color: #4f46e5; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>TABEL JADWAL RENCANA PEMBELAJARAN TKA KELAS XII</h2>
      <p><b>Mata Pelajaran:</b> ${mataPelajaran}</p>
      <p><b>Periode Pembelajaran:</b> Juli, Agustus, September dan Oktober</p>
      <p><b>Tanggal Ekspor:</b> ${new Date().toLocaleDateString('id-ID')}</p>
      <br/>
      <table style="border-collapse: collapse; border: 1px solid #cccccc; width: 100%;">
        <thead>
          <tr style="background-color: #4f46e5; color: white;">
            <th style="border: 1px solid #cccccc; padding: 10px; width: 120px;">Bulan</th>
            <th style="border: 1px solid #cccccc; padding: 10px; width: 120px;">Minggu Ke-</th>
            <th style="border: 1px solid #cccccc; padding: 10px; width: 220px;">Elemen / Materi</th>
            <th style="border: 1px solid #cccccc; padding: 10px; width: 280px;">Sub-elemen / Submateri</th>
            <th style="border: 1px solid #cccccc; padding: 10px; width: 350px;">Kompetensi yang Diuji</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Jadwal_Pembelajaran_TKA_Kelas_XII_${mataPelajaran.replace(/\s+/g, '_')}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Jadwal Rencana Pembelajaran to Word (.doc)
 */
export function exportJadwalToWord(items: JadwalItem[], mataPelajaran: string, pageSize: string = 'A4') {
  const tableRows = items
    .map(
      (item) => `
    <tr>
      <td style="border: 1px solid #000000; padding: 8px; text-align: center; font-weight: bold; background-color: #f1f5f9;">${item.bulan}</td>
      <td style="border: 1px solid #000000; padding: 8px; text-align: center;">Minggu ke-${item.mingguKe}</td>
      <td style="border: 1px solid #000000; padding: 8px; font-weight: bold;">${item.elemenMateri}</td>
      <td style="border: 1px solid #000000; padding: 8px;">${item.subElemenMateri}</td>
      <td style="border: 1px solid #000000; padding: 8px; font-style: italic;">${item.kompetensi}</td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${pageSize === 'F4' ? '21.5cm 33cm' : '21cm 29.7cm'};
          margin: 1.5cm 1.5cm 1.5cm 1.5cm;
        }
        body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.4; }
        h2 { color: #4f46e5; text-align: center; margin-bottom: 5px; }
        .meta { font-size: 11pt; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th { background-color: #e2e8f0; font-weight: bold; border: 1px solid #000000; padding: 8px; text-align: center; }
        td { border: 1px solid #000000; padding: 8px; font-size: 10pt; }
      </style>
    </head>
    <body>
      <h2>TABEL JADWAL RENCANA PEMBELAJARAN TKA KELAS XII</h2>
      <div class="meta">
        <b>Mata Pelajaran:</b> ${mataPelajaran}<br/>
        <b>Periode Pembelajaran:</b> Juli, Agustus, September dan Oktober<br/>
        <b>Tanggal Pembuatan:</b> ${new Date().toLocaleDateString('id-ID')}<br/>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Bulan</th>
            <th style="width: 15%;">Minggu Ke-</th>
            <th style="width: 20%;">Elemen / Materi</th>
            <th style="width: 25%;">Sub-elemen / Submateri</th>
            <th style="width: 25%;">Kompetensi yang Diuji</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Jadwal_Pembelajaran_TKA_Kelas_XII_${mataPelajaran.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


