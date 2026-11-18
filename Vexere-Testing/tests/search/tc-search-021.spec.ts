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

// Màn hình điện thoại 390 × 844 (bố cục điện thoại có thể khác máy tính)
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('TC-SEARCH-021 - Tìm kiếm trên màn hình điện thoại', async ({ page }) => {
  const khongCuonNgang = async (viTri: string) => {
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(`[${viTri}] scrollWidth=${sw} clientWidth=${cw}`);
    return sw <= cw + 2;   // cho lệch tối đa 2px
  };
  const ngay = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Form hiển thị đầy đủ, không có thanh cuộn ngang
  expect.soft(await khongCuonNgang('Trang chủ'), 'Trang chủ bị cuộn ngang ở 390px: ghi nhận lỗi giao diện').toBe(true);
  await expect(page.getByText('Nơi xuất phát')).toBeVisible();
  await expect(page.getByText('Nơi đến')).toBeVisible();
  await expect(page.getByText('Thêm ngày về')).toBeVisible();
  await expect(page.getByTestId('SearchWidget.search')).toBeVisible();

  // 4. Chọn Hồ Chí Minh → Nha Trang - Khánh Hòa, ngày đi hôm nay + 1
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

  // 5. Nhấn nút tìm kiếm
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);

  // 6. Kết quả giống máy tính: đúng ngày, có "Kết quả", thẻ chuyến đọc được, nút nhấn được
  await expect(page.getByText(ngay.hienThi).first()).toBeVisible();
  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 20000 });
  expect((await layChuyen(page, 1)).length).toBe(1);
  await expect(page.getByText(/^(Chọn chỗ|Gọi đặt vé)$/).first()).toBeEnabled();
  expect.soft(await khongCuonNgang('Trang kết quả'), 'Trang kết quả bị cuộn ngang ở 390px: ghi nhận lỗi giao diện').toBe(true);

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-021-PASS.png'),
    fullPage: true
  });

});