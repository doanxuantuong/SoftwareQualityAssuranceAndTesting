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

test('TC-SEARCH-020 - Thẻ "Tuyến đường phổ biến" Hà Nội - Hải Phòng dẫn đúng tuyến và đúng giá', async ({ page }) => {
  const ngay = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tới mục "Tuyến đường phổ biến"
  const the = page.getByText('Hà Nội - Hải Phòng', { exact: true }).first();
  await the.scrollIntoViewIfNeeded();
  await expect(the).toBeVisible();

  // 4. Ghi lại giá "Từ …đ" trên thẻ
  const textThe = await the.evaluate(el => {
    let p: HTMLElement | null = el as HTMLElement;
    for (let k = 0; k < 6 && p; k++) { if (/Từ\s*[\d.]+đ/.test(p.innerText)) return p.innerText; p = p.parentElement; }
    return '';
  });
  const giaThe = Number(textThe.match(/Từ\s*([\d.]+)đ/)![1].replace(/\./g, ''));

  // 5. Nhấn thẻ: mở đúng trang tuyến Hà Nội → Hải Phòng
  await the.click();
  await expect(page).toHaveURL(/ve-xe-khach-tu-ha-noi-di-hai-phong/);

  // 6. Nếu trang chưa kèm ngày: chọn Ngày đi là hôm nay + 1 và tìm
  const nutChonNgay = page.getByText(/^Chọn ngày$/).first();
  if (await nutChonNgay.isVisible().catch(() => false)) {
    await nutChonNgay.click();
    await page
      .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
      .nth(ngay.thangLech)
      .click();
    await page.getByTestId('SearchWidget.search').click();
  }

  // 7. Sắp xếp "Giá tăng dần": giá chuyến đầu bằng giá trên thẻ (khác thì ghi lại ngày xem và nguyên nhân)
  await page.keyboard.press('Escape');   // đóng lịch của thanh tìm kiếm nếu còn mở, tránh che nút sắp xếp
  await page.getByText('Giá tăng dần', { exact: true }).click({ timeout: 5000 }).catch(() => page.getByText('Giá tăng dần', { exact: true }).dispatchEvent('click'));
  await page.waitForTimeout(1500);
  const [dau] = await layChuyen(page, 1);
  console.log(`Giá thẻ: ${giaThe} | giá chuyến rẻ nhất: ${dau.gia}`);
  expect.soft(dau.gia).toBe(giaThe);

  // 8. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-020-PASS.png'),
    fullPage: true
  });

});