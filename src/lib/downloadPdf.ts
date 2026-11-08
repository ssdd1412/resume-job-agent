import type { PdfPayload } from '../types';

/** base64 → Uint8Array（避免 atob 得到 Latin-1 字符串后再逐字节转换出错） */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * 把后端下发的 PDF 载荷存成文件。
 *
 * 走 Blob + 临时 objectURL，不依赖任何后端静态目录；下载后立刻释放 URL，
 * 避免在长会话里堆积内存。
 */
export function downloadPdf(pdf: PdfPayload): void {
  const buffer = base64ToBuffer(pdf.base64);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = pdf.filename || '简历.pdf';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // 给浏览器一点时间发起下载再回收
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
