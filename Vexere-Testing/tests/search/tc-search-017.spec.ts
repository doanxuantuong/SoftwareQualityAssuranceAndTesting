import { test, expect, Page } from '@playwright/test';
import path from 'path';

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Ngày = hôm nay + soNgay. thangLech: 0 = tháng hiện tại, 1 = tháng kế tiếp (lịch hiển thị 2 tháng)
function ngayTu(soNgay: number) {
  const homNay = new Date();
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const ngay = d.getDate();
  const thangLech = (d.getFullYear() - homNay.getFullYear()) * 12 + d.getMonth() - homNay.getMonth();
  const hienThi = `${THU[d.getDay()]}, ${String(ngay).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return { ngay, thangLech, hienThi };
}

// Lấy thông tin các chuyến đầu tiên: đi lên từ nút "Chọn chỗ"/"Gọi đặt vé" đến thẻ chứa giờ và giá
async function layChuyen(page: Page, toiDa = 10) {
  const nut = page.getByText(/^(Chọn chỗ|Gọi đặt vé)$/);
  await nut.first().waitFor({ state: 'visible', timeout: 20000 });
  const n = Math.min(await nut.count(), toiDa);
  const ds: { text: string; nhaXe: string; gio: number | null; gia: number | null; danhGia: number | null }[] = [];
  for (let i = 0; i < n; i++) {
    const text = await nut.nth(i).evaluate(el => {
      let p: HTMLElement | null = el as HTMLElement;
      for (let k = 0; k < 15 && p; k++) {
        p = p.parentElement;
        if (p && /\d{1,2}:\d{2}/.test(p.innerText) && /\d[\d.]*\s*đ/.test(p.innerText)) return p.innerText;
      }
      return '';
    });
    const g = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const gia = [...text.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*đ/g)].map(m => Number(m[1].replace(/\./g, '')));
    const dg = text.match(/(\d(?:\.\d)?)\s*\(\s*[\d.,]+\s*\)/);
    ds.push({
      text,
      nhaXe: text.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '',
      gio: g ? Number(g[1]) * 60 + Number(g[2]) : null,
      gia: gia.length ? Math.min(...gia) : null,
      danhGia: dg ? Number(dg[1]) : null,
    });
  }
  return ds;
}

test('TC-SEARCH-017 - Lọc theo Nhà xe trên danh sách chuyến', async ({ page }) => {
  const ngay = ngayTu(5);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tìm Ninh Bình → Nha Trang - Khánh Hòa, hôm nay + 5
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Ninh Bình');
  await page.getByRole('paragraph').filter({ hasText: /^Ninh Bình$/ }).filter({ visible: true }).first().click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Nha Trang');
  await page.getByRole('paragraph').filter({ hasText: /^Nha Trang - Khánh Hòa$/ }).filter({ visible: true }).first().click();
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();

  // Click không chờ điều hướng hoàn tất (trang kết quả hay bị treo sự kiện load do script bên thứ ba),
  // sau đó chờ URL đổi ở mức 'commit' và chờ tiêu đề kết quả hiển thị.
  await page.getByTestId('SearchWidget.search').click({ noWaitAfter: true });
  await page.waitForURL(url => url.pathname !== '/', { timeout: 30000, waitUntil: 'commit' });

  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 30000 });
  const banDau = Number((await tieuDe.innerText()).match(/\d+/)![0]);

  // 4. Ở khối Lọc, mục Nhà xe: chọn nhà xe đầu tiên, dạng "Tên nhà xe (n)"
  const dongCoSo = /^[^\d(][^()]* \(\d+\)$/;   // dạng: Tên nhà xe (n); bỏ qua dòng điểm đánh giá trên thẻ chuyến như 4.6 (3846)
  const khoiNhaXe = page
    .locator('div')
    .filter({ has: page.getByText('Nhà xe', { exact: true }) })
    .filter({ has: page.getByText(dongCoSo) })
    .last();   // khối nhỏ nhất chứa tiêu đề Nhà xe và danh sách nhà xe
  const mucNhaXe = khoiNhaXe.getByText(dongCoSo).first();
  const nhan = (await mucNhaXe.innerText()).trim();
  const ten = nhan.replace(/\s*\(\d+\)$/, '');
  const soTheoNhan = Number(nhan.match(/\((\d+)\)$/)![1]);
  await mucNhaXe.click();

  // 5. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-017-PASS.png'),
    fullPage: true
  });
});