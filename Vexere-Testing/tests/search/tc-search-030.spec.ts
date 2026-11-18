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

test('TC-SEARCH-030 - Lọc theo Loại xe và xóa bộ lọc', async ({ page }) => {
  const ngay = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tìm Sài Gòn → Nha Trang - Khánh Hòa, hôm nay + 1; ghi lại "Kết quả" ban đầu
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Nha Trang');
  await page.getByRole('paragraph').filter({ hasText: /^Nha Trang - Khánh Hòa(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);
  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 20000 });
  const banDau = Number((await tieuDe.innerText()).match(/\d+/)![0]);

  // 4. Khối Lọc, mục Loại xe: chọn Limousine
  // Mục Loại xe ở khối Lọc là mục thu gọn: bấm tiêu đề để mở danh sách trước
  await page.getByRole('paragraph').filter({ hasText: /^Loại xe$/ }).filter({ visible: true }).first().click();
  // Các lựa chọn dạng "Limousine giường nằm (92)", "Limousine giường phòng (n)"...: chọn mục Limousine đầu tiên
  await page.getByText(/^Limousine .*\(\d+\)$/).filter({ visible: true }).first().click();

  // 5. Số chuyến giảm hoặc bằng; mọi chuyến còn lại thuộc loại Limousine (Limousine/Luxury/phòng/VIP/Cabin)
  const soChuyen = async () => Number((await page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first().innerText()).match(/\d+/)![0]);
  await expect.poll(soChuyen, { timeout: 15000 }).toBeLessThanOrEqual(banDau);
  for (const c of await layChuyen(page, 10)) expect.soft(c.text).toMatch(/Limousine|Luxury|phòng|VIP|Cabin/i);   // nhóm Limousine gồm cả loại ghi "Luxury 34 phòng", không có chữ Limousine
  // Mục Giá (thanh trượt 200.000đ - 400.000đ) và Điểm đón: chưa tự động, cần locator từ codegen

  // 6. Nhấn "Xóa lọc": số chuyến trở về ban đầu
  await page.getByText(/^Xóa lọc$/).first().click();
  await expect.poll(soChuyen, { timeout: 15000 }).toBe(banDau);

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-030-PASS.png'),
    fullPage: true
  });

});