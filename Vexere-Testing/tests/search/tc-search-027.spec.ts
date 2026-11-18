import { test, expect } from '@playwright/test';
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

test('TC-SEARCH-027 - Chuyến chỉ nhận đặt qua điện thoại hiển thị nút "Gọi đặt vé"', async ({ page }) => {
  const homNay = ngayTu(0);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tìm Hải Phòng → Sa Pa - Lào Cai, ngày hôm nay
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hải Phòng');
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng$/ }).first().click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Sa Pa');
  await page.getByRole('paragraph').filter({ hasText: /^Sa Pa - Lào Cai$/ }).first().click();
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${homNay.ngay}$`) })
    .nth(homNay.thangLech)
    .click();
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);
  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 20000 });

  // 4. Tìm chuyến có nút "Gọi đặt vé" (phụ thuộc dữ liệu ngày chạy)
  const nutGoi = page.getByText(/^Gọi đặt vé$/).first();
  test.skip(!(await nutGoi.isVisible().catch(() => false)), 'Không có chuyến "Gọi đặt vé" ở tuyến/ngày này');

  // 5. Thẻ chuyến khác chuyến thường: không có "Còn … chỗ trống", không có nhãn "Xác nhận tức thì"
  const the = await nutGoi.evaluate(el => {
    let p: HTMLElement | null = el as HTMLElement;
    for (let k = 0; k < 15 && p; k++) { p = p.parentElement; if (p && /\d{1,2}:\d{2}/.test(p.innerText) && /\d[\d.]*\s*đ/.test(p.innerText)) return p.innerText; }
    return '';
  });
  expect(the).not.toMatch(/Còn\s+\d+\s+chỗ trống/);
  expect(the).not.toContain('Xác nhận tức thì');
  expect(the).toMatch(/\d[\d.]*\s*đ/);

  // 6. Nhấn "Gọi đặt vé" một lần: không chuyển sang bước chọn ghế (không thực hiện cuộc gọi thật)
  await nutGoi.click();
  await expect(page.getByText('Chỗ mong muốn')).toHaveCount(0);

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-027-PASS.png'),
    fullPage: true
  });

});
